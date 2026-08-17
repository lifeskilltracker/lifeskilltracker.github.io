/**
 * The smallest static server that serves what GitHub Pages serves.
 *
 * `adapter-static` is configured with `fallback: '404.html'`, so every route the
 * build did not prerender — `/s/[tree]` and `/s/[tree]/m/[slug]`, which are the
 * two the accessibility passes spend the most time in — arrives as a 404 that
 * the SPA shell then routes client-side. A server that 404s with an empty body
 * instead would make those flows untestable for a reason that has nothing to do
 * with the app.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export function serve(root, port = 0) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    // `normalize` after stripping the leading slash is what stops `..` escaping
    // the build directory; this server is local-only but need not be careless.
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, relative);

    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) file = join(root, '404.html');

    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
