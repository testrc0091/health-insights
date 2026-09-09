import type { Table } from "dexie";
import type { z } from "zod";

export interface Repository<T, Key extends string> {
  getAll(): Promise<T[]>;
  getById(id: Key): Promise<T | undefined>;
  /** Validates then inserts/replaces one row. Returns the row's key. */
  put(entity: T): Promise<Key>;
  /** Validates then inserts/replaces many rows in one transaction — the path used by
   * every import (JSON restore, Apple Health export, Strong CSV). */
  bulkPut(entities: T[]): Promise<void>;
  delete(id: Key): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Every write — a live UI form save or a bulk import — goes through the entity's Zod
 * schema before it ever reaches Dexie (ARCHITECTURE.md §7: "an import is not a
 * trusted bulk-insert, it goes through the same validation path as any other write").
 * `schema.parse` throws on invalid data, which callers surface as a validation error
 * rather than silently persisting a malformed row.
 */
export function createRepository<T, Key extends string>(
  table: Table<T, Key>,
  schema: z.ZodType<T>,
): Repository<T, Key> {
  return {
    getAll: () => table.toArray(),
    getById: (id) => table.get(id as never),
    put: (entity) => table.put(schema.parse(entity)) as Promise<Key>,
    bulkPut: async (entities) => {
      const validated = entities.map((e) => schema.parse(e));
      await table.bulkPut(validated);
    },
    delete: (id) => table.delete(id as never),
    clear: () => table.clear(),
  };
}
