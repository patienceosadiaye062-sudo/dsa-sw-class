import { randomUUID, randomBytes } from 'node:crypto';

const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newId() {
  return randomUUID();
}

export function newReference() {
  // Rejection sampling avoids modulo bias while keeping codes readable aloud.
  let code = '';
  while (code.length < 8) {
    for (const byte of randomBytes(16)) {
      const limit = 256 - (256 % REFERENCE_ALPHABET.length);
      if (byte >= limit) continue;
      code += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
      if (code.length === 8) break;
    }
  }
  return code;
}
