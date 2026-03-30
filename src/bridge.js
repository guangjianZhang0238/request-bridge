const http = require('http');
const https = require('https');
const net = require('net');
const { loadConfig } = require('./config');

function createLogger(logLevel = 'info', hooks = {}) {
  return function log(level, message, meta = {}) {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(logLevel)) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      meta,
      line: `[${new Date().toISOString()}] [${level}] ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''}`,
    };
    if (hooks.onLog) hooks.onLog(entry);
    else console.log(entry.line);
  };
}

function normalizePort(port, protocol) {
  if (port) return Number(port);
  return protocol === 'https:' ? 443 : 80;
}

function sanitizeHeaders(headers) {
  const next = { ...headers };
  delete next['proxy-connection'];
  delete next['proxy-authorization'];
  delete next['connection'];
  return next;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function parseAbsoluteUrl(req) {
  try {
    return new URL(req.url);
  } catch {
    const host = req.headers.host;
    if (!host) return null;
    const proto = req.socket.encrypted ? 'https:' : 'http:';
    return new URL(`${proto}//${host}${req.url}`);
  }
}

function isAllowedHost(config, hostname) {
  if (!config.allowedHosts.length) return true;
  return config.allowedHosts.includes(String(hostname || '').toLowerCase());
}

function matchRule(config, input) {
  for (const rule of config.remapRules) {
    const m = rule.match || {};
    const hostOk = !m.host || String(m.host).toLowerCase() === String(input.host).toLowerCase();
    const portOk = !m.port || Number(m.port) === Number(input.port);
    const protocolOk = !m.protocol || String(m.protocol).toLowerCase() === String(input.protocol).toLowerCase();
    const pathOk = !m.pathPrefix || String(input.path || '').startsWith(String(m.pathPrefix));
    if (hostOk && portOk && protocolOk && pathOk) return rule;
  }
  return null;
}

function applyRemap(config, input) {
  const rule = matchRule(config, input);
  if (!rule) return { ...input, remapped: false, rule: null };
  const target = rule.target || {};
  return {
    host: target.host || input.host,
    port: normalizePort(target.port || input.port, target.protocol || input.protocol),
    protocol: target.protocol || input.protocol,
    path: typeof target.path === 'string' ? target.path : input.path,
    remapped: true,
    rule,
  };
}

function startBridge(options = {}) {
  const baseDir = options.baseDir;
  const config = options.config || loadConfig(baseDir);
  const state = {
    config,
    startedAt: null,
    lastError: null,
  };
  const log = createLogger(config.logLevel, { onLog: options.onLog });

  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        service: 'request-bridge',
        port: config.port,
        rules: config.remapRules.length,
        allowedHosts: config.allowedHosts,
        time: new Date().toISOString(),
      });
    }

    const targetUrl = parseAbsoluteUrl(req);
    if (!targetUrl) {
      return sendJson(res, 400, { error: 'bad_request', message: 'Unable to determine target URL.' });
    }

    const original = {
      protocol: targetUrl.protocol,
      host: targetUrl.hostname,
      port: normalizePort(targetUrl.port, targetUrl.protocol),
      path: `${targetUrl.pathname || '/'}${targetUrl.search || ''}`,
    };

    if (!isAllowedHost(config, original.host)) {
      return sendJson(res, 403, { error: 'forbidden_host', host: original.host });
    }

    const mapped = applyRemap(config, original);
    const client = mapped.protocol === 'https:' ? https : http;
    const headers = sanitizeHeaders(req.headers);
    headers.host = mapped.host + ((mapped.protocol === 'https:' && mapped.port !== 443) || (mapped.protocol === 'http:' && mapped.port !== 80) ? `:${mapped.port}` : '');
    headers['x-request-bridge-original-host'] = original.host;
    headers['x-request-bridge-original-port'] = String(original.port);
    headers['x-request-bridge-original-protocol'] = original.protocol;
    headers['x-request-bridge-remapped'] = String(mapped.remapped);

    log('info', 'forward_http', {
      method: req.method,
      from: `${original.protocol}//${original.host}:${original.port}${original.path}`,
      to: `${mapped.protocol}//${mapped.host}:${mapped.port}${mapped.path}`,
      remapped: mapped.remapped,
    });

    const upstreamReq = client.request({
      protocol: mapped.protocol,
      hostname: mapped.host,
      port: mapped.port,
      method: req.method,
      path: mapped.path,
      headers,
      timeout: config.requestTimeoutMs,
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.statusMessage, upstreamRes.headers);
      upstreamRes.pipe(res);
    });

    upstreamReq.on('timeout', () => {
      upstreamReq.destroy(new Error('upstream timeout'));
    });

    upstreamReq.on('error', (err) => {
      state.lastError = err.message;
      log('error', 'forward_http_failed', { error: err.message, host: mapped.host, port: mapped.port });
      if (!res.headersSent) {
        sendJson(res, 502, { error: 'bad_gateway', message: err.message });
      } else {
        res.destroy(err);
      }
    });

    req.pipe(upstreamReq);
  });

  server.on('connect', (req, clientSocket, head) => {
    const [hostPart, portPart] = String(req.url || '').split(':');
    const original = {
      protocol: 'https:',
      host: hostPart,
      port: Number(portPart || 443),
      path: '',
    };

    if (!original.host) {
      clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      return clientSocket.destroy();
    }

    if (!isAllowedHost(config, original.host)) {
      clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return clientSocket.destroy();
    }

    const mapped = applyRemap(config, original);

    log('info', 'forward_connect', {
      from: `${original.host}:${original.port}`,
      to: `${mapped.host}:${mapped.port}`,
      remapped: mapped.remapped,
    });

    const upstreamSocket = net.connect(mapped.port, mapped.host);
    upstreamSocket.setTimeout(config.connectTimeoutMs);

    upstreamSocket.on('connect', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: request-bridge\r\n\r\n');
      if (head && head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    });

    upstreamSocket.on('timeout', () => {
      upstreamSocket.destroy(new Error('connect timeout'));
    });

    upstreamSocket.on('error', (err) => {
      state.lastError = err.message;
      log('error', 'forward_connect_failed', { error: err.message, host: mapped.host, port: mapped.port });
      try {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      } catch {}
      clientSocket.destroy();
    });

    clientSocket.on('error', () => upstreamSocket.destroy());
    clientSocket.on('close', () => upstreamSocket.destroy());
    upstreamSocket.on('close', () => clientSocket.destroy());
  });

  server.on('clientError', (err, socket) => {
    log('warn', 'client_error', { error: err.message });
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      state.startedAt = new Date().toISOString();
      log('info', 'request_bridge_started', {
        listen: `${config.host}:${config.port}`,
        rules: config.remapRules.length,
        allowedHosts: config.allowedHosts,
      });
      resolve({
        server,
        config,
        state,
        stop: () => new Promise((resolveStop) => server.close(() => resolveStop())),
      });
    });
  });
}

module.exports = {
  startBridge,
};
