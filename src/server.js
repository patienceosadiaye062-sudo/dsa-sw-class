import { config } from './config.js';
import { createApp } from './http/app.js';

const server = createApp();

server.on('error', error => {
  console.error(`Server failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(config.port, () => {
  console.log(`Ticketing server listening on port ${config.port}.`);
});
