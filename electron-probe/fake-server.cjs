'use strict';
// 仅用于验证 daemon 进程生命周期的本地假服务：不含真实账户或令牌。
const http = require('node:http');

function start(port, onRequest) {
  const server = http.createServer((req, res) => {
    if (onRequest) onRequest(req.method + ' ' + req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/daemon/workspaces')) {
      res.end('[]');
    } else {
      res.end('{}');
    }
    req.resume();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { start };

if (require.main === module) {
  start(Number(process.argv[2] || 18080), (line) => console.log(line)).then(() => console.log('listening'));
}
