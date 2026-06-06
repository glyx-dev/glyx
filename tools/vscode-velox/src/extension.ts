import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ── State ──────────────────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;
let devTerminal: vscode.Terminal | undefined;
let treeProvider: VeloxTreeDataProvider;

// ── Activation ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  // Context key so menus/when clauses work
  updateProjectContext();

  // Status bar — quick "▶ Velox" button always visible in velox projects
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'velox.run';
  context.subscriptions.push(statusBarItem);
  refreshStatusBar();

  // Tree view for the activity bar panel
  treeProvider = new VeloxTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('veloxProject', treeProvider)
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
      if (doc.fileName.endsWith('velox.config.json') || doc.fileName.endsWith('velox.config.ts')) {
        treeProvider.refresh();
      }
    })
  );

  // Track terminal lifecycle
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((t) => {
      if (t === devTerminal) {
        devTerminal = undefined;
        vscode.commands.executeCommand('setContext', 'velox.devRunning', false);
        refreshStatusBar();
        treeProvider.refresh();
      }
    })
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('velox.run',          cmdRun),
    vscode.commands.registerCommand('velox.stopDev',      cmdStop),
    vscode.commands.registerCommand('velox.build',        () => cmdRun1('build')),
    vscode.commands.registerCommand('velox.package',      cmdPackage),
    vscode.commands.registerCommand('velox.openConfig',   cmdOpenConfig),
    vscode.commands.registerCommand('velox.createProject', cmdCreateProject),
  );

  // Task provider so velox tasks work in tasks.json
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider('velox', new VeloxTaskProvider())
  );
}

export function deactivate() {
  devTerminal?.dispose();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getProjectRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return undefined;
  const velox = folders.find(f =>
    fs.existsSync(path.join(f.uri.fsPath, 'velox.config.json')) ||
    fs.existsSync(path.join(f.uri.fsPath, 'velox.config.ts'))
  );
  return (velox ?? folders[0])?.uri.fsPath;
}

function isVeloxProject(): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return false;
  return folders.some(f =>
    fs.existsSync(path.join(f.uri.fsPath, 'velox.config.json')) ||
    fs.existsSync(path.join(f.uri.fsPath, 'velox.config.ts'))
  );
}

function getProjectName(): string {
  const root = getProjectRoot();
  if (!root) return 'Velox App';
  const configPath = path.join(root, 'velox.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (cfg.name) return cfg.name;
    } catch {}
  }
  return path.basename(root);
}

function getCli(): string {
  return vscode.workspace.getConfiguration('velox').get<string>('cliPath') ?? 'velox';
}

function updateProjectContext() {
  const is = isVeloxProject();
  vscode.commands.executeCommand('setContext', 'velox.isVeloxProject', is);
}

function refreshStatusBar() {
  if (!isVeloxProject()) {
    statusBarItem.hide();
    return;
  }
  const running = devTerminal !== undefined;
  statusBarItem.text     = running ? '$(stop-circle) Velox' : '$(play) Velox';
  statusBarItem.tooltip  = running ? 'Stop Velox Dev Server' : 'Run Velox Dev Server';
  statusBarItem.command  = running ? 'velox.stopDev' : 'velox.run';
  statusBarItem.backgroundColor = running
    ? new vscode.ThemeColor('statusBarItem.warningBackground')
    : undefined;
  statusBarItem.show();
}

// ── Commands ────────────────────────────────────────────────────────────────────

function cmdRun() {
  const root = getProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage('No Velox project found in the workspace.');
    return;
  }

  // Reuse existing terminal if still open
  if (devTerminal) {
    devTerminal.show();
    return;
  }

  devTerminal = vscode.window.createTerminal({
    name: `Velox Dev — ${getProjectName()}`,
    cwd: root,
  });
  devTerminal.show();
  devTerminal.sendText(`${getCli()} dev`);

  vscode.commands.executeCommand('setContext', 'velox.devRunning', true);
  refreshStatusBar();
  treeProvider.refresh();
}

function cmdStop() {
  if (!devTerminal) return;
  devTerminal.sendText('\u0003'); // Ctrl+C
  setTimeout(() => {
    devTerminal?.dispose();
    devTerminal = undefined;
    vscode.commands.executeCommand('setContext', 'velox.devRunning', false);
    refreshStatusBar();
    treeProvider.refresh();
  }, 500);
}

async function cmdRun1(command: 'build' | 'dev') {
  const root = getProjectRoot();
  if (!root) {
    vscode.window.showErrorMessage('No Velox project found in the workspace.');
    return;
  }

  let args = '';
  if (command === 'build') {
    const target = vscode.workspace.getConfiguration('velox').get<string>('buildTarget');
    if (target) args = ` --target ${target}`;
  }

  const term = vscode.window.createTerminal({
    name: `Velox ${command === 'build' ? 'Build' : 'Dev'}`,
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
    { title: 'Package Velox App — Target Platform', placeHolder: 'Select a target' }
  );
  if (!target) return;

  const term = vscode.window.createTerminal({ name: 'Velox Package', cwd: root });
  term.show();
  term.sendText(`${getCli()} package${target.value ? ' ' + target.value : ''}`);
}

function cmdOpenConfig() {
  const root = getProjectRoot();
  if (!root) return;

  const jsonPath = path.join(root, 'velox.config.json');
  const tsPath   = path.join(root, 'velox.config.ts');
  const target   = fs.existsSync(tsPath) ? tsPath : jsonPath;

  if (!fs.existsSync(target)) {
    vscode.window.showErrorMessage('No velox.config.json or velox.config.ts found.');
    return;
  }
  vscode.workspace.openTextDocument(target).then(doc =>
    vscode.window.showTextDocument(doc)
  );
}

async function cmdCreateProject() {
  const name = await vscode.window.showInputBox({
    prompt:      'Project name',
    placeHolder: 'my-velox-app',
    validateInput: v => v && /^[a-z0-9-]+$/.test(v) ? null : 'Use lowercase letters, numbers, and hyphens only',
  });
  if (!name) return;

  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true, canSelectFiles: false, openLabel: 'Select parent folder',
  });
  if (!folder) return;

  const term = vscode.window.createTerminal({ name: 'Velox Create', cwd: folder[0].fsPath });
  term.show();
  term.sendText(`velox create ${name}`);
}

// ── Tree View ──────────────────────────────────────────────────────────────────

class VeloxTreeDataProvider implements vscode.TreeDataProvider<VeloxItem> {
  private _change = new vscode.EventEmitter<VeloxItem | undefined | void>();
  readonly onDidChangeTreeData = this._change.event;

  refresh() { this._change.fire(); }

  getTreeItem(e: VeloxItem): vscode.TreeItem { return e; }

  getChildren(element?: VeloxItem): VeloxItem[] {
    if (element) return [];

    const running = devTerminal !== undefined;
    const name    = getProjectName();

    const items: VeloxItem[] = [
      new VeloxStatusItem(name, running),
    ];

    if (running) {
      items.push(new VeloxCmdItem('Stop Dev Server', 'velox.stopDev', 'stop-circle'));
    } else {
      items.push(new VeloxCmdItem('Run Dev Server', 'velox.run', 'play-circle'));
    }

    items.push(
      new VeloxCmdItem('Build', 'velox.build', 'package'),
      new VeloxCmdItem('Package for Distribution', 'velox.package', 'archive'),
      new VeloxCmdItem('Open Config', 'velox.openConfig', 'settings-gear'),
    );

    return items;
  }
}

class VeloxItem extends vscode.TreeItem {}

class VeloxStatusItem extends VeloxItem {
  constructor(name: string, running: boolean) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.description = running ? 'running' : 'idle';
    this.iconPath = new vscode.ThemeIcon(
      running ? 'circle-filled' : 'circle-outline',
      running ? new vscode.ThemeColor('testing.runAction') : undefined
    );
    this.contextValue = 'veloxProjectStatus';
  }
}

class VeloxCmdItem extends VeloxItem {
  constructor(label: string, cmd: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command    = { command: cmd, title: label, arguments: [] };
    this.iconPath   = new vscode.ThemeIcon(icon);
    this.contextValue = 'veloxCommand';
  }
}

// ── Task Provider ──────────────────────────────────────────────────────────────

class VeloxTaskProvider implements vscode.TaskProvider {
  static type = 'velox';

  provideTasks(): vscode.Task[] {
    const root = getProjectRoot();
    if (!root) return [];
    const cli = getCli();

    const makeTask = (command: string, name: string, group?: vscode.TaskGroup) => {
      const task = new vscode.Task(
        { type: 'velox', command },
        vscode.TaskScope.Workspace,
        name,
        'velox',
        new vscode.ShellExecution(`${cli} ${command}`, { cwd: root }),
        ['$velox-cargo', '$velox-js']
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
    if (def.type !== VeloxTaskProvider.type) return undefined;

    const root = getProjectRoot();
    if (!root) return undefined;

    const args = def.args?.join(' ') ?? '';
    const cmd  = `${getCli()} ${def.command}${args ? ' ' + args : ''}`;
    task.execution = new vscode.ShellExecution(cmd, { cwd: root });
    return task;
  }
}
