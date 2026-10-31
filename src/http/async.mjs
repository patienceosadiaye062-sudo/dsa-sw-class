import { DomainError } from '../domain/errors.js';

export async function readJsonBody(request) {
  const contentType = request.headers['content-type'] ?? '';
  if (!/(?:^|\/|\+)json(?:\s*;|$)/i.test(contentType)) return undefined;

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('INVALID_JSON', 'Request body must contain valid JSON.');
  }
}
