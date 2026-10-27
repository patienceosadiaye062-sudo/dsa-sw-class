function readPort(value) {
  if (value === undefined || value === '') return 3000;
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function getConfig(env = process.env) {
  return Object.freeze({ port: readPort(env.PORT) });
}

export const config = getConfig();
