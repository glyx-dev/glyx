import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ── State ──────────────────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;
let devTerminal: vscode.Terminal | undefined;
let treeProvider: GlyxTreeDataProvider;

// ── Activation ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  // Context key so menus/when clauses work
  updateProjectContext();

  // Status bar — quick "▶ Glyx" button always visible in glyx projects
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'glyx.run';
  context.subscriptions.push(statusBarItem);
  refreshStatusBar();

  // Tree view for the activity bar panel
  treeProvider = new GlyxTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('glyxProject', treeProvider)
  );

  // Refresh when workspace changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      updateProjectContext();
      refreshStatusBar();
      treeProvider.refresh();
    })
  );

  // Refresh tree when config file is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('glyx.config.json') || doc.fileName.endsWith('glyx.config.ts')) {
        treeProvider.refresh();
      }
    })
  );

  // Track terminal lifecycle
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((t) => {
      if (t === devTerminal) {
        devTerminal = undefined;
        vscode.commands.executeCommand('setContext', 'glyx.devRunning', false);
        refreshStatusBar();
        treeProvider.refresh();
      }
    })
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('glyx.run',          cmdRun),
    vscode.commands.registerCommand('glyx.stopDev',      cmdStop),
    vscode.commands.registerCommand('glyx.build',        () => cmdRun1('build')),
    vscode.commands.registerCommand('glyx.package',      cmdPackage),
    vscode.commands.registerCommand('glyx.openConfig',   cmdOpenConfig),
    vscode.commands.registerCommand('glyx.createProject', cmdCreateProject),
  );

  // Task provider so glyx tasks work in tasks.json
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider('glyx', new GlyxTaskProvider())
  );
}

export function deactivate() {
  devTerminal?.dispose();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getProjectRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return undefined;
  const glyx = folders.find(f =>
    fs.existsSync(path.join(f.uri.fsPath, 'glyx.config.json')) ||
    fs.existsSync(path.join(f.uri.fsPath, 'glyx.config.ts'))
  );
  return (glyx ?? folders[0])?.uri.fsPath;
}

function isGlyxProject(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return false;
  return folders.some(f =>
    fs.existsSync(path.join(f.uri.fsPath, 'glyx.config.json')) ||
    fs.existsSync(path.join(f.uri.fsPath, 'glyx.config.ts'))
  );
}

function getProjectName(): string {
  const root = getProjectRoot();
  if (!root) return 'Glyx App';
  const configPath = path.join(root, 'glyx.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cfg.name) return cfg.name;
    } catch {}
  }
  return path.basename(root);
}

function getCli(): string {
  return vscode.workspace.getConfiguration('glyx').get<string>('cliPath') ?? 'glyx';
}

function updateProjectContext() {
  const is = isGlyxProject();
  vscode.commands.executeCommand('setContext', 'glyx.isGlyxProject', is);
}

function refreshStatusBar() {
  if (!isGlyxProject()) {
    statusBarItem.hide();
    return;
  }
  const running = devTerminal !== undefined;
  statusBarItem.text     = running ? '$(stop-circle) Glyx' : '$(play) Glyx';
  statusBarItem.tooltip  = running ? 'Stop Glyx Dev Server' : 'Run Glyx Dev Server';
  statusBarItem.command  = running ? 'glyx.stopDev' : 'glyx.run';
  statusBarItem.backgroundColor = running
    ? new vscode.ThemeColor('statusBarItem.warningBackground')
    : undefined;
  statusBarItem.show();
}

// ── Commands ────────────────────────────────────────────────────────────────────

function cmdRun() {
  const root = getProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage('No Glyx project found in the workspace.');
    return;
  }

  // Reuse existing terminal if still open
  if (devTerminal) {
    devTerminal.show();
    return;
  }

  devTerminal = vscode.window.createTerminal({
    name: `Glyx Dev — ${getProjectName()}`,
    cwd: root,
  });
  devTerminal.show();
  devTerminal.sendText(`${getCli()} dev`);

  vscode.commands.executeCommand('setContext', 'glyx.devRunning', true);
  refreshStatusBar();
  treeProvider.refresh();
}

function cmdStop() {
  if (!devTerminal) return;
  devTerminal.sendText('\u0003'); // Ctrl+C
  setTimeout(() => {
    devTerminal?.dispose();
    devTerminal = undefined;
    vscode.commands.executeCommand('setContext', 'glyx.devRunning', false);
    refreshStatusBar();
    treeProvider.refresh();
  }, 500);
}

async function cmdRun1(command: 'build' | 'dev') {
  const root = getProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage('No Glyx project found in the workspace.');
    return;
  }

  let args = '';
  if (command === 'build') {
    const target = vscode.workspace.getConfiguration('glyx').get<string>('buildTarget');
    if (target) args = ` --target ${target}`;
  }

  const term = vscode.window.createTerminal({
    name: `Glyx ${command === 'build' ? 'Build' : 'Dev'}`,
    cwd: root,
  });
  term.show();
  term.sendText(`${getCli()} ${command}${args}`);
}

async function cmdPackage() {
  const root = getProjectRoot();
  if (!root) return;

  const target = await vscode.window.showQuickPick(
    [
      { label: '$(device-desktop) Current Platform', value: '' },
      { label: '$(symbol-keyword) Windows',          value: '--target windows' },
      { label: '$(symbol-keyword) macOS',            value: '--target macos' },
      { label: '$(symbol-keyword) Linux',            value: '--target linux' },
    ],
    { title: 'Package Glyx App — Target Platform', placeHolder: 'Select a target' }
  );
  if (!target) return;

  const term = vscode.window.createTerminal({ name: 'Glyx Package', cwd: root });
  term.show();
  term.sendText(`${getCli()} package${target.value ? ' ' + target.value : ''}`);
}

function cmdOpenConfig() {
  const root = getProjectRoot();
  if (!root) return;

  const jsonPath = path.join(root, 'glyx.config.json');
  const tsPath   = path.join(root, 'glyx.config.ts');
  const target   = fs.existsSync(tsPath) ? tsPath : jsonPath;

  if (!fs.existsSync(target)) {
    vscode.window.showErrorMessage('No glyx.config.json or glyx.config.ts found.');
    return;
  }
  vscode.workspace.openTextDocument(target).then(doc =>
    vscode.window.showTextDocument(doc)
  );
}

async function cmdCreateProject() {
  const name = await vscode.window.showInputBox({
    prompt:      'Project name',
    placeHolder: 'my-glyx-app',
    validateInput: v => v && /^[a-z0-9-]+$/.test(v) ? null : 'Use lowercase letters, numbers, and hyphens only',
  });
  if (!name) return;

  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true, canSelectFiles: false, openLabel: 'Select parent folder',
  });
  if (!folder) return;

  const term = vscode.window.createTerminal({ name: 'Glyx Create', cwd: folder[0].fsPath });
  term.show();
  term.sendText(`glyx create ${name}`);
}

// ── Tree View ──────────────────────────────────────────────────────────────────

class GlyxTreeDataProvider implements vscode.TreeDataProvider<GlyxItem> {
  private _change = new vscode.EventEmitter<GlyxItem | undefined | void>();
  readonly onDidChangeTreeData = this._change.event;

  refresh() { this._change.fire(); }

  getTreeItem(e: GlyxItem): vscode.TreeItem { return e; }

  getChildren(element?: GlyxItem): GlyxItem[] {
    if (element) return [];

    const running = devTerminal !== undefined;
    const name    = getProjectName();

    const items: GlyxItem[] = [
      new GlyxStatusItem(name, running),
    ];

    if (running) {
      items.push(new GlyxCmdItem('Stop Dev Server', 'glyx.stopDev', 'stop-circle'));
    } else {
      items.push(new GlyxCmdItem('Run Dev Server', 'glyx.run', 'play-circle'));
    }

    items.push(
      new GlyxCmdItem('Build', 'glyx.build', 'package'),
      new GlyxCmdItem('Package for Distribution', 'glyx.package', 'archive'),
      new GlyxCmdItem('Open Config', 'glyx.openConfig', 'settings-gear'),
    );

    return items;
  }
}

class GlyxItem extends vscode.TreeItem {}

class GlyxStatusItem extends GlyxItem {
  constructor(name: string, running: boolean) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = running ? 'running' : 'idle';
    this.iconPath = new vscode.ThemeIcon(
      running ? 'circle-filled' : 'circle-outline',
      running ? new vscode.ThemeColor('testing.runAction') : undefined
    );
    this.contextValue = 'glyxProjectStatus';
  }
}

class GlyxCmdItem extends GlyxItem {
  constructor(label: string, cmd: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command    = { command: cmd, title: label, arguments: [] };
    this.iconPath   = new vscode.ThemeIcon(icon);
    this.contextValue = 'glyxCommand';
  }
}

// ── Task Provider ──────────────────────────────────────────────────────────────

class GlyxTaskProvider implements vscode.TaskProvider {
  static type = 'glyx';

  provideTasks(): vscode.Task[] {
    const root = getProjectRoot();
    if (!root) return [];
    const cli = getCli();

    const makeTask = (command: string, name: string, group?: vscode.TaskGroup) => {
      const task = new vscode.Task(
        { type: 'glyx', command },
        vscode.TaskScope.Workspace,
        name,
        'glyx',
        new vscode.ShellExecution(`${cli} ${command}`, { cwd: root }),
        ['$glyx-cargo', '$glyx-js']
      );
      if (group) task.group = group;
      return task;
    };

    return [
      makeTask('dev',     'Run Dev Server'),
      makeTask('build',   'Build',   vscode.TaskGroup.Build),
      makeTask('package', 'Package'),
    ];
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const def = task.definition as { type: string; command: string; args?: string[] };
    if (def.type !== GlyxTaskProvider.type) return undefined;

    const root = getProjectRoot();
    if (!root) return undefined;

    const args = def.args?.join(' ') ?? '';
    const cmd  = `${getCli()} ${def.command}${args ? ' ' + args : ''}`;
    task.execution = new vscode.ShellExecution(cmd, { cwd: root });
    return task;
  }
}
