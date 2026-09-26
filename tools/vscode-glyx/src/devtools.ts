// "Glyx: Open DevTools": the Glyx DevTools UI in an editor panel.
//
// Starts `glyx inspect --no-open --port 0` (the DevTools relay + UI), reads
// the page address it prints, and shows that page in a webview through an
// iframe. The iframe's origin is 127.0.0.1, which the relay accepts; a
// webview's own vscode-webview:// origin would be refused. Closing the panel
// stops the relay.

import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';

let panel: vscode.WebviewPanel | undefined;
let relay: ChildProcess | undefined;
let pageUrl: string | undefined;

function themeParam(): 'light' | 'dark' {
  const k = vscode.window.activeColorTheme.kind;
  return k === vscode.ColorThemeKind.Light || k === vscode.ColorThemeKind.HighContrastLight ? 'light' : 'dark';
}

/** Start the relay and resolve with the page URL it prints. */
function startRelay(cli: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cli, ['inspect', '--no-open', '--port', '0'], { cwd, shell: process.platform === 'win32' });
    relay = proc;
    let out = '';
    const timer = setTimeout(() => reject(new Error('`glyx inspect` did not start within 15 s')), 15000);
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
      const m = out.match(/Glyx DevTools: (http:\/\/127\.0\.0\.1:\d+\/#s=[0-9a-f]+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.stderr?.on('data', (d: Buffer) => { out += d.toString(); });
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      relay = undefined;
      reject(new Error(`\`glyx inspect\` exited (${code}): ${out.trim().slice(-300)}`));
    });
  });
}

function html(url: string, webview: vscode.Webview): string {
  const origin = new URL(url).origin;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; style-src ${webview.cspSource} 'unsafe-inline';">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden;background:transparent}</style>
</head><body><iframe src="${url}&theme=${themeParam()}" title="Glyx DevTools"></iframe></body></html>`;
}

export async function openDevtools(context: vscode.ExtensionContext, cli: string, cwd: string) {
  if (panel) { panel.reveal(); return; }
  try {
    pageUrl = relay && pageUrl ? pageUrl : await startRelay(cli, cwd);
  } catch (e) {
    vscode.window.showErrorMessage(`Could not start Glyx DevTools: ${(e as Error).message}`);
    return;
  }
  panel = vscode.window.createWebviewPanel('glyxDevtools', 'Glyx DevTools', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'glyx-activity.svg');
  panel.webview.html = html(pageUrl, panel.webview);

  // Follow the editor's theme (reloads the page; the chosen app is kept).
  const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
    if (panel && pageUrl) panel.webview.html = html(pageUrl, panel.webview);
  });
  panel.onDidDispose(() => {
    themeSub.dispose();
    panel = undefined;
    relay?.kill();
    relay = undefined;
    pageUrl = undefined;
  });
}

export function stopDevtools() {
  panel?.dispose();
  relay?.kill();
}
