import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = process.cwd();
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/should-not-navigate') { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>Navigation restored</title><h1>Page navigation works</h1>'); return; }
  const file = resolve(root, '.' + pathname);
  if (!file.startsWith(root + '/') || /node_modules|\.git|\.fudge/.test(pathname)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    if (pathname.endsWith('csp.html')) res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'");
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1');
