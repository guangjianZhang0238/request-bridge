const http = require('http');

const port = Number(process.env.DEMO_UPSTREAM_PORT || 9090);

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      upstream: 'demo-b',
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
      time: new Date().toISOString(),
    }, null, 2));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`demo upstream listening on 127.0.0.1:${port}`);
});
