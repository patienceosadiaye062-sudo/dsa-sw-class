import { config } from './config.js';
import { createApp } from './http/app.js';
import { createApiRouter } from './http/apiRoutes.js';
import { createDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';
import { createEventService } from './services/eventService.js';
import { createBookingService } from './services/bookingService.js';
import { createMockPaymentGateway } from './lib/mockPaymentGateway.js';

const database = createDatabase();
const repository = createSqliteRepository(database);
const eventService = createEventService(repository);
const bookingService = createBookingService(repository, createMockPaymentGateway());
const server = createApp({ router: createApiRouter({ eventService, bookingService }) });

server.on('error', error => {
  console.error(`Server failed: ${error.message}`);
  database.close();
  process.exitCode = 1;
});

server.listen(config.port, () => {
  console.log(`Ticketing server listening on port ${config.port}.`);
});
