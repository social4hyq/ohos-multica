'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// 由实际鸿蒙运行时执行；标准上游 Electron 的静态检查不能替代真机结果。
const evidence = {
  platform: process.platform,
  arch: process.arch,
  versions: process.versions,
  checks: []
};
function check(name, run) {
  try {
    evidence.checks.push({ name, pass: true, detail: run() });
  } catch (error) {
    evidence.checks.push({ name, pass: false, detail: String(error) });
  }
}
ipcMain.on('probe:bootstrap', (event) => {
  event.returnValue = { version: app.getVersion(), platform: process.platform };
});
ipcMain.handle('probe:ping', (_event, value) => 'pong:' + value);
ipcMain.handle('probe:report', (_event, result) => {
  evidence.renderer = result;
  const report = path.join(app.getPath('userData'), 'probe-report.json');
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
  console.log('ELECTRON_OHOS_PROBE ' + JSON.stringify(evidence));
  return { report };
});
const { spawn } = require('node:child_process');
const fakeServer = require('./fake-server.cjs');

function daemonLog(event, data) {
  const line = 'ELECTRON_OHOS_DAEMON ' + JSON.stringify(Object.assign({ t: new Date().toISOString(), event }, data));
  console.log(line);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return false; }
}

// 长期拉起 multica daemon（假服务 + 假令牌，不连接任何真实服务）。
async function runDaemonProbe() {
  const seconds = Number(process.env.PROBE_DAEMON_SECONDS || 300);
  const requests = [];
  const server = await fakeServer.start(18080, (line) => requests.push(line));
  const home = path.join(app.getPath('userData'), 'daemon-home');
  fs.mkdirSync(path.join(home, '.multica'), { recursive: true });
  fs.writeFileSync(path.join(home, '.multica', 'config.json'),
    JSON.stringify({ server_url: 'http://127.0.0.1:18080', token: 'fake' }));
  const roots = [
    path.dirname(process.execPath),
    process.resourcesPath || '',
    path.join(__dirname, '..', '..'),
    '/data/storage/el1/bundle/libs/arm64',
    '/data/storage/el1/bundle/libs/arm64-v8a',
    '/data/app/el1/bundle/public/com.huawei.ohos_electron/libs/arm64',
    '/data/app/el1/bundle/public/com.huawei.ohos_electron/libs/arm64-v8a'
  ];
  const names = ['libmultica_daemon.so', 'multica'];
  const candidates = [];
  for (const root of roots) {
    for (const name of names) candidates.push(path.join(root, name));
    candidates.push(path.join(root, 'bin', 'multica'));
  }
  candidates.push(path.join(__dirname, '..', 'bin', 'multica'));
  const found = [];
  (function walk(dir, depth) {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name === 'multica') found.push(full);
    }
  })('/data/app/el1/bundle/public/com.huawei.ohos_electron', 0);
  daemonLog('walk', { found });
  for (const file of found) candidates.push(file);
  daemonLog('env', { execPath: process.execPath, resourcesPath: process.resourcesPath, dirname: __dirname, home });
  let existing = candidates.filter((file) => fs.existsSync(file));
  existing = Array.from(new Set(existing));
  for (const file of existing) {
    const st = fs.statSync(file);
    daemonLog('stat', { file, mode: (st.mode & 0o7777).toString(8), uid: st.uid, size: st.size });
  }
  // 把包内二进制复制到可写目录并 chmod，看系统是否允许从数据目录执行。
  const stageDirs = [
    path.join(app.getPath('userData'), 'bin'),
    path.join(app.getPath('temp'), 'multica-bin'),
    app.getPath('cache') ? path.join(app.getPath('cache'), 'multica-bin') : null
  ].filter(Boolean);
  const staged = [];
  const source = existing[0];
  for (const dir of stageDirs) {
    const target = path.join(dir, 'multica');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(source, target);
      fs.chmodSync(target, 0o755);
      staged.push(target);
      daemonLog('staged', { target, mode: (fs.statSync(target).mode & 0o7777).toString(8) });
    } catch (error) {
      daemonLog('stage-failed', { dir, error: String(error).slice(0, 200) });
    }
  }
  existing = staged.concat(existing);
  daemonLog('candidates', { existing, tried: candidates });
  let child = null;
  let used = null;
  for (const file of existing) {
    const record = { file, size: fs.statSync(file).size };
    try {
      const out = execFileSync(file, ['version'], { encoding: 'utf8', timeout: 8000, env: Object.assign({}, process.env, { HOME: home }) });
      record.version = out.split('\n')[0];
      daemonLog('version-ok', record);
    } catch (error) {
      record.error = String(error).slice(0, 300);
      daemonLog('version-failed', record);
      continue;
    }
    used = file;
    break;
  }
  if (!used) { daemonLog('no-runnable-binary', {}); return; }
  const output = [];
  const started = Date.now();
  child = spawn(used, ['daemon', 'start', '--foreground', '--no-auto-update'], {
    env: Object.assign({}, process.env, { HOME: home }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal, afterMs: Date.now() - started }; daemonLog('exit', exited); });
  child.on('error', (error) => daemonLog('spawn-error', { error: String(error) }));
  daemonLog('spawned', { pid: child.pid, used });
  let ticks = 0;
  while (!exited && Date.now() - started < seconds * 1000) {
    await sleep(30000);
    ticks += 1;
    daemonLog('tick', { n: ticks, pid: child.pid, alive: child.pid ? alive(child.pid) : false, exited: !!exited, requests: requests.length, elapsedMs: Date.now() - started });
  }
  daemonLog('output-head', { text: output.join('').slice(0, 1200) });
  if (exited) { daemonLog('died-early', exited); server.close(); return; }
  const stopAt = Date.now();
  child.kill('SIGTERM');
  for (let i = 0; i < 100 && !exited; i += 1) await sleep(100);
  let forced = false;
  if (!exited) { forced = true; child.kill('SIGKILL'); for (let i = 0; i < 50 && !exited; i += 1) await sleep(100); }
  daemonLog('stopped', { forced, exited, stopMs: Date.now() - stopAt, pidAliveAfter: alive(child.pid), totalRequests: requests.length, sample: requests.slice(0, 6) });
  server.close();
  daemonLog('done', {});
}


const http = require('node:http');
function healthOnce(timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.get({ host: '127.0.0.1', port: 19514, path: '/health', timeout: timeoutMs, agent: false }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (error) { /* 保留原文 */ }
        resolve({ ok: res.statusCode === 200, status: res.statusCode, ms: Date.now() - started,
          pid: parsed && parsed.pid, uptime: parsed && parsed.uptime, state: parsed && parsed.status,
          raw: parsed ? undefined : body.slice(0, 200) });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (error) => resolve({ ok: false, ms: Date.now() - started, error: String(error.code || error.message) }));
  });
}
// daemon 由外部单独运行，主进程只通过本机 HTTP 连接它。
async function runHealthProbe() {
  const seconds = Number(process.env.PROBE_HEALTH_SECONDS || 90);
  const samples = [];
  const started = Date.now();
  while (Date.now() - started < seconds * 1000) {
    const sample = await healthOnce(3000);
    samples.push(sample);
    daemonLog('health', Object.assign({ n: samples.length }, sample));
    await sleep(5000);
  }
  const okCount = samples.filter((item) => item.ok).length;
  const pids = Array.from(new Set(samples.filter((item) => item.pid).map((item) => item.pid)));
  daemonLog('health-summary', { samples: samples.length, ok: okCount, failed: samples.length - okCount, pids,
    firstError: (samples.find((item) => !item.ok) || {}).error });
  daemonLog('health-done', {});
  if (process.env.PROBE_QUIT !== '0') setTimeout(() => app.quit(), 2000);
}

let window;
app.whenReady().then(() => {
  runHealthProbe().catch((error) => daemonLog('probe-error', { error: String(error && error.stack || error) }));
  if (process.env.PROBE_DAEMON === '1') {
    runDaemonProbe().catch((error) => daemonLog('probe-error', { error: String(error && error.stack || error) }));
  }
  check('文件写入与读取', () => {
    const file = path.join(app.getPath('userData'), 'probe-file.txt');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'electron-ohos-file-ok');
    const value = fs.readFileSync(file, 'utf8');
    if (value !== 'electron-ohos-file-ok') throw new Error('文件内容不匹配');
    return value;
  });
  check('child_process 启动系统 shell', () => {
    const shell = process.env.PROBE_CHILD_EXECUTABLE || '/system/bin/sh';
    const value = execFileSync(shell, ['-c', 'printf electron-child-ok'], {
      encoding: 'utf8', timeout: 5000
    });
    if (value !== 'electron-child-ok') throw new Error('子进程输出不匹配');
    return value;
  });
  window = new BrowserWindow({
    width: 960, height: 720,
    webPreferences: {
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  window.webContents.on('preload-error', (_event, _file, error) => {
    console.error('ELECTRON_OHOS_PRELOAD_ERROR ' + String(error));
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('ELECTRON_OHOS_RENDER_EXIT ' + JSON.stringify(details));
  });
  return window.loadFile(path.join(__dirname, 'index.html'));
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
app.on('window-all-closed', () => app.quit());
