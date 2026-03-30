const fs = require('fs');
const path = require('path');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseJsonArray(value, name) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    throw new Error(`invalid ${name}: ${err.message}`);
  }
}

function createConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    host: env.HOST || '0.0.0.0',
    logLevel: env.LOG_LEVEL || 'info',
    connectTimeoutMs: Number(env.CONNECT_TIMEOUT_MS || 15000),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS || 30000),
    allowedHosts: (env.ALLOWED_HOSTS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    remapRules: parseJsonArray(env.REMAP_RULES || '[]', 'REMAP_RULES'),
  };
}

function serializeEnv(config) {
  const lines = [
    `PORT=${Number(config.port || 8080)}`,
    `HOST=${config.host || '0.0.0.0'}`,
    `LOG_LEVEL=${config.logLevel || 'info'}`,
    `CONNECT_TIMEOUT_MS=${Number(config.connectTimeoutMs || 15000)}`,
    `REQUEST_TIMEOUT_MS=${Number(config.requestTimeoutMs || 30000)}`,
    '',
    '# 允许作为普通前向代理的目标主机白名单。逗号分隔；留空表示不限制。',
    `ALLOWED_HOSTS=${(config.allowedHosts || []).join(',')}`,
    '',
    '# A -> B 重写规则，JSON 数组。支持 host/port/protocol/pathPrefix 重定向。',
    `REMAP_RULES=${JSON.stringify(config.remapRules || [])}`,
    '',
  ];
  return lines.join('\n');
}

function validateConfigShape(input) {
  const cfg = {
    port: Number(input.port || 8080),
    host: String(input.host || '0.0.0.0').trim() || '0.0.0.0',
    logLevel: String(input.logLevel || 'info').trim() || 'info',
    connectTimeoutMs: Number(input.connectTimeoutMs || 15000),
    requestTimeoutMs: Number(input.requestTimeoutMs || 30000),
    allowedHosts: Array.isArray(input.allowedHosts)
      ? input.allowedHosts.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : String(input.allowedHosts || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    remapRules: Array.isArray(input.remapRules) ? input.remapRules : parseJsonArray(String(input.remapRules || '[]'), 'REMAP_RULES'),
  };

  if (!Number.isFinite(cfg.port) || cfg.port <= 0) throw new Error('PORT 不合法');
  if (!Number.isFinite(cfg.connectTimeoutMs) || cfg.connectTimeoutMs <= 0) throw new Error('CONNECT_TIMEOUT_MS 不合法');
  if (!Number.isFinite(cfg.requestTimeoutMs) || cfg.requestTimeoutMs <= 0) throw new Error('REQUEST_TIMEOUT_MS 不合法');

  cfg.remapRules = cfg.remapRules.map((rule, index) => {
    const match = rule?.match || {};
    const target = rule?.target || {};
    if (!target.host) throw new Error(`规则 ${index + 1} 缺少 target.host`);
    return {
      match: {
        ...(match.host ? { host: String(match.host).trim() } : {}),
        ...(match.port ? { port: Number(match.port) } : {}),
        ...(match.protocol ? { protocol: String(match.protocol).trim() } : {}),
        ...(match.pathPrefix ? { pathPrefix: String(match.pathPrefix).trim() } : {}),
      },
      target: {
        host: String(target.host).trim(),
        ...(target.port ? { port: Number(target.port) } : {}),
        ...(target.protocol ? { protocol: String(target.protocol).trim() } : {}),
        ...(typeof target.path === 'string' && target.path !== '' ? { path: target.path } : {}),
      },
    };
  });

  return cfg;
}

function saveConfig(baseDir, input) {
  const config = validateConfigShape(input);
  const envPath = path.join(baseDir, '.env');
  fs.writeFileSync(envPath, serializeEnv(config), 'utf8');
  return config;
}

function loadConfig(baseDir = path.join(__dirname, '..')) {
  loadDotEnv(path.join(baseDir, '.env'));
  return createConfig(process.env);
}

module.exports = {
  loadDotEnv,
  parseJsonArray,
  createConfig,
  loadConfig,
  serializeEnv,
  validateConfigShape,
  saveConfig,
};
