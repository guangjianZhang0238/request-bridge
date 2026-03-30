const http = require('http');

const proxyHost = process.env.PROXY_HOST || '127.0.0.1';
const proxyPort = Number(process.env.PROXY_PORT || 8080);

const req = http.request({
  host: proxyHost,
  port: proxyPort,
  method: 'POST',
  path: 'http://a.example.test/demo?x=1',
  headers: {
    'content-type': 'application/json',
    'x-demo': 'request-bridge',
  },
}, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('status:', res.statusCode);
    console.log(data);
  });
});

req.on('error', (err) => {
  console.error('client error:', err.message);
  process.exit(1);
});

req.end(JSON.stringify({ hello: 'world' }));
