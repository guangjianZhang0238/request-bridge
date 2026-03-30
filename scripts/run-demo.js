const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function run(name, cmd, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      process.stdout.write(`[${name}] ${d}`);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      process.stderr.write(`[${name}] ${d}`);
    });
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${name} exited with code ${code}`));
    });
    resolve.child = child;
  });
}

(async () => {
  const env = {
    PORT: '8081',
    REMAP_RULES: JSON.stringify([
      {
        match: { host: 'a.example.test', port: 80, protocol: 'http:' },
        target: { host: '127.0.0.1', port: 9090, protocol: 'http:' },
      },
    ]),
  };

  const upstream = spawn(process.execPath, ['scripts/demo-upstream.js'], {
    cwd: root,
    env: { ...process.env, DEMO_UPSTREAM_PORT: '9090' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  upstream.stdout.on('data', (d) => process.stdout.write(`[upstream] ${d}`));
  upstream.stderr.on('data', (d) => process.stderr.write(`[upstream] ${d}`));

  const proxy = spawn(process.execPath, ['src/server.js'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proxy.stdout.on('data', (d) => process.stdout.write(`[proxy] ${d}`));
  proxy.stderr.on('data', (d) => process.stderr.write(`[proxy] ${d}`));

  await new Promise((r) => setTimeout(r, 1200));

  const client = spawn(process.execPath, ['scripts/demo-client.js'], {
    cwd: root,
    env: { ...process.env, PROXY_PORT: '8081' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  client.stdout.on('data', (d) => process.stdout.write(`[client] ${d}`));
  client.stderr.on('data', (d) => process.stderr.write(`[client] ${d}`));

  await new Promise((resolve, reject) => {
    client.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`client exited ${code}`))));
  });

  proxy.kill('SIGTERM');
  upstream.kill('SIGTERM');
})();
