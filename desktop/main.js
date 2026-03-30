const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { startBridge } = require('../src/bridge');
const { loadConfig, saveConfig } = require('../src/config');

const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

let mainWindow;
let tray = null;
let bridgeInstance = null;
let runtime = {
  logs: [],
  events: [],
  requests: [],
  config: null,
  processStatus: 'stopped',
  serviceHealth: 'unknown',
  lastError: null,
};

function pushLog(entry) {
  runtime.logs.push(entry);
  if (runtime.logs.length > 1000) runtime.logs.shift();
  if (entry.level === 'error' || entry.level === 'warn') runtime.lastError = entry.line;
  mainWindow?.webContents.send('bridge:log', entry);
}

function pushEvent(title, detail) {
  const event = {
    time: new Date().toISOString(),
    title,
    detail,
  };
  runtime.events.unshift(event);
  runtime.events = runtime.events.slice(0, 50);
  mainWindow?.webContents.send('bridge:event', event);
}

function pushRequest(req) {
  runtime.requests.push(req);
  if (runtime.requests.length > 2000) runtime.requests.shift();
  mainWindow?.webContents.send('bridge:request', req);
}

function currentStatus() {
  const cfg = runtime.config || safeLoadConfig();
  return {
    processStatus: runtime.processStatus,
    serviceHealth: runtime.serviceHealth,
    config: cfg,
    startedAt: bridgeInstance?.state?.startedAt || null,
    logs: runtime.logs,
    events: runtime.events,
    requests: runtime.requests,
    envPath,
    lastError: runtime.lastError,
    listenUrl: cfg ? `http://${cfg.host === '0.0.0.0' ? '127.0.0.1' : cfg.host}:${cfg.port}` : null,
  };
}

function safeLoadConfig() {
  try {
    runtime.config = loadConfig(projectRoot);
    return runtime.config;
  } catch (err) {
    runtime.lastError = err.message;
    return null;
  }
}

function createRequestLogger() {
  return function logRequest(info) {
    const req = {
      time: new Date().toISOString(),
      method: info.method || '-',
      from: info.from || '-',
      to: info.to || '-',
      protocol: info.protocol || '-',
      status: info.status || 'forwarded',
      remapped: !!info.remapped,
      error: info.error || null,
    };
    pushRequest(req);
  };
}

function updateTray() {
  if (!tray) return;
  const status = runtime.processStatus === 'running' ? '运行中' : '已停止';
  const health = runtime.serviceHealth === 'healthy' ? '✓' : runtime.serviceHealth === 'degraded' ? '⚠' : '';
  const title = `Request Bridge - ${status} ${health}`;
  tray.setTitle(title);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开控制台',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: runtime.processStatus === 'running' ? '停止代理' : '启动代理',
      click: async () => {
        if (runtime.processStatus === 'running') {
          await stopService();
        } else {
          await startService();
        }
        updateTray();
      },
    },
    {
      label: '重启代理',
      click: async () => {
        await restartService();
        updateTray();
      },
      enabled: runtime.processStatus !== 'stopped',
    },
    { type: 'separator' },
    {
      label: '打开配置目录',
      click: () => shell.openPath(projectRoot),
    },
    {
      label: '打开 .env',
      click: () => shell.openPath(envPath),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  
  tray.setContextMenu(contextMenu);
}

async function startService() {
  if (bridgeInstance) return currentStatus();
  runtime.config = safeLoadConfig();
  if (!runtime.config) throw new Error(runtime.lastError || '配置加载失败');
  runtime.processStatus = 'starting';
  const requestLogger = createRequestLogger();
  const instance = await startBridge({
    baseDir: projectRoot,
    config: runtime.config,
    onLog: pushLog,
    onRequest: requestLogger,
  });
  bridgeInstance = instance;
  runtime.processStatus = 'running';
  runtime.serviceHealth = 'starting';
  pushEvent('代理已启动', `${runtime.config.host}:${runtime.config.port}`);
  mainWindow?.webContents.send('bridge:status', currentStatus());
  updateTray();
  return currentStatus();
}

async function stopService() {
  if (!bridgeInstance) {
    runtime.processStatus = 'stopped';
    runtime.serviceHealth = 'unknown';
    return currentStatus();
  }
  await bridgeInstance.stop();
  bridgeInstance = null;
  runtime.processStatus = 'stopped';
  runtime.serviceHealth = 'unknown';
  pushEvent('代理已停止', '服务已关闭');
  mainWindow?.webContents.send('bridge:status', currentStatus());
  updateTray();
  return currentStatus();
}

async function restartService() {
  await stopService();
  return startService();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // 创建托盘
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // 如果没有图标文件，使用系统默认
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('Request Bridge');
  updateTray();
  
  // 点击托盘显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  // 窗口关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function runHealthCheck() {
  return new Promise((resolve) => {
    const cfg = runtime.config || safeLoadConfig();
    if (!cfg) return resolve({ ok: false, error: runtime.lastError || '配置加载失败' });
    const req = http.get({ host: '127.0.0.1', port: cfg.port, path: '/healthz', timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          runtime.serviceHealth = json.ok ? 'healthy' : 'degraded';
          resolve({ ok: !!json.ok, statusCode: res.statusCode, body: json });
        } catch (err) {
          runtime.serviceHealth = 'degraded';
          resolve({ ok: false, statusCode: res.statusCode, error: err.message, raw: body });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('health check timeout'));
    });
    req.on('error', (err) => {
      runtime.serviceHealth = 'down';
      resolve({ ok: false, error: err.message });
    });
  });
}

async function diagnostics() {
  const cfg = runtime.config || safeLoadConfig();
  const checks = [];
  checks.push({ item: '配置加载', ok: !!cfg, detail: cfg ? '成功' : (runtime.lastError || '失败') });
  checks.push({ item: '环境文件', ok: fs.existsSync(envPath), detail: envPath });
  checks.push({ item: '当前进程状态', ok: runtime.processStatus === 'running', detail: runtime.processStatus });
  const health = await runHealthCheck();
  checks.push({ item: '健康检查', ok: !!health.ok, detail: health.ok ? JSON.stringify(health.body) : (health.error || JSON.stringify(health)) });
  return {
    time: new Date().toISOString(),
    checks,
  };
}

async function saveConfigFromUi(payload) {
  const wasRunning = runtime.processStatus === 'running';
  if (wasRunning) {
    await stopService();
  }
  runtime.config = saveConfig(projectRoot, payload);
  runtime.lastError = null;
  pushEvent('配置已保存', '已写入 .env');
  if (wasRunning) {
    await startService();
    pushEvent('代理已重启', '配置保存后自动重启生效');
  }
  mainWindow?.webContents.send('bridge:status', currentStatus());
  updateTray();
  return currentStatus();
}

ipcMain.handle('bridge:get-status', async () => currentStatus());
ipcMain.handle('bridge:start', async () => startService());
ipcMain.handle('bridge:stop', async () => stopService());
ipcMain.handle('bridge:restart', async () => restartService());
ipcMain.handle('bridge:diagnostics', async () => diagnostics());
ipcMain.handle('bridge:health-check', async () => runHealthCheck());
ipcMain.handle('bridge:open-config-dir', async () => shell.openPath(projectRoot));
ipcMain.handle('bridge:open-env-file', async () => shell.openPath(envPath));
ipcMain.handle('bridge:reload-config', async () => {
  runtime.config = safeLoadConfig();
  mainWindow?.webContents.send('bridge:status', currentStatus());
  return currentStatus();
});
ipcMain.handle('bridge:save-config', async (_event, payload) => saveConfigFromUi(payload));
ipcMain.handle('bridge:clear-logs', async () => {
  runtime.logs = [];
  mainWindow?.webContents.send('bridge:status', currentStatus());
  return currentStatus();
});
ipcMain.handle('bridge:clear-requests', async () => {
  runtime.requests = [];
  mainWindow?.webContents.send('bridge:status', currentStatus());
  return currentStatus();
});

app.isQuitting = false;

app.whenReady().then(() => {
  safeLoadConfig();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (bridgeInstance) await bridgeInstance.stop();
    app.quit();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  if (bridgeInstance) await bridgeInstance.stop();
});
