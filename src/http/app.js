import { createServer } from 'node:http';
import { realpath, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { readJsonBody } from './async.mjs';
import { createRouter } from './router.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultPublicDir = path.join(projectRoot, 'public');
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8']
]);
const statusByCode = new Map([
  ['INVALID_JSON', 400],
  ['VALIDATION', 400],
  ['NOT_FOUND', 404],
  ['INVALID_STATE', 409],
  ['INVALID_TRANSITION', 409],
  ['SOLD_OUT', 409],
  ['UNAUTHORIZED', 401],
  ['FORBIDDEN', 403],
  ['PAYMENT_DECLINED', 402]
]);

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendError(response, error) {
  const knownError = error instanceof DomainError;
  const code = knownError ? error.code : 'INTERNAL_ERROR';
  const message = knownError ? error.message : 'An unexpected server error occurred.';
  sendJson(response, statusByCode.get(code) ?? 500, { error: { code, message } });
}

function isWithinDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function serveStatic(request, response, publicDir, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new DomainError('NOT_FOUND', 'File was not found.');
  }

  const root = await realpath(publicDir);
  const relativePath = decodedPath.replace(/^[/\\]+/, '');
  let target = path.resolve(root, relativePath || 'index.html');
  if (!isWithinDirectory(root, target)) throw new DomainError('NOT_FOUND', 'File was not found.');

  let info;
  try {
    info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, 'index.html');
      info = await stat(target);
    }
    target = await realpath(target);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new DomainError('NOT_FOUND', 'File was not found.');
    }
    throw error;
  }

  if (!isWithinDirectory(root, target) || !info.isFile()) {
    throw new DomainError('NOT_FOUND', 'File was not found.');
  }

  const body = await readFile(target);
  response.writeHead(200, {
    'content-type': mimeTypes.get(path.extname(target).toLowerCase()) ?? 'application/octet-stream',
    'content-length': body.length
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function createApp({
  router = createRouter(),
  publicDir = defaultPublicDir,
  logger = console
} = {}) {
  router.add('GET', '/health', () => ({ status: 200, body: { status: 'ok' } }));

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const body = await readJsonBody(request);
      const route = router.match(request.method, url.pathname);

      if (route) {
        const result = await route.handler({ request, params: route.params, body });
        const status = result?.status ?? 200;
        sendJson(response, status, result?.body ?? result);
        return;
      }

      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        throw new DomainError('NOT_FOUND', 'API route was not found.');
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        throw new DomainError('NOT_FOUND', 'Route was not found.');
      }
      await serveStatic(request, response, publicDir, url.pathname);
    } catch (error) {
      if (response.headersSent) {
        logger.error('Request failed after response headers were sent:', error);
        response.destroy(error);
        return;
      }
      if (!(error instanceof DomainError)) logger.error('Unhandled request error:', error);
      sendError(response, error);
    }
  });
}
