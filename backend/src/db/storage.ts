/**
 * Single source of truth for the storage mode. Postgres is the default;
 * STORAGE=memory (or no DATABASE_URL) switches every repo to an in-memory
 * implementation that lives until the process restarts.
 */
export const useMemoryStorage =
  process.env.STORAGE === "memory" || !process.env.DATABASE_URL;

if (useMemoryStorage) {
  console.warn(
    "[storage] using in-memory store; data resets on restart. Set DATABASE_URL for Postgres.",
  );
}
