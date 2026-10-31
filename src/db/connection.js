import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceDirectory, '..', '..');
const schema = readFileSync(path.join(sourceDirectory, 'schema.sql'), 'utf8');

export const defaultDatabasePath = path.resolve(
  process.env.DATABASE_PATH ?? path.join(projectRoot, 'data', 'ticketing.sqlite')
);

export function createDatabase(databasePath = defaultDatabasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(schema);
  return database;
}
