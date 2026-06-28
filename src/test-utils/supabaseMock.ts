/**
 * Controllable mock of the `supabase` client used across `src/lib/routines.ts`.
 *
 * The real client exposes a fluent query builder
 * (`supabase.from(table).select().eq()...`) that is then `await`ed (or finished
 * with `.single()`) to yield `{ data, error }`. This mock reproduces that shape:
 *
 *   - every builder method is chainable and records its call,
 *   - the builder is thenable and `.single()`-able, resolving to a configured
 *     `{ data, error }` keyed by `"<table>.<operation>"` (falling back to
 *     `"<table>"`),
 *   - all operations are captured in `calls` for assertions.
 *
 * Tests wire it in with:
 *
 *   jest.mock('../supabase', () => require('../../test-utils/supabaseMock'));
 *
 * The `require` inside the factory returns this module's singleton, so the test
 * file can import `__setResponses` / `__reset` / `calls` from the same module to
 * drive and inspect it.
 */

export type SupabaseResult = { data?: unknown; error?: unknown };

export type RecordedCall = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  chain: Array<{ method: string; args: unknown[] }>;
};

const DATA_VERBS = new Set(['select', 'insert', 'update', 'delete']);
const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'eq',
  'in',
  'not',
  'is',
  'order',
  'limit',
] as const;

let responseQueues: Record<string, SupabaseResult[]> = {};

/** Every `from()` call made since the last `__reset()`, in order. */
export const calls: RecordedCall[] = [];

/**
 * Configure the result(s) returned for each `"<table>.<operation>"` (or bare
 * `"<table>"`) key. Pass an array to return different results across repeated
 * calls; a single object is reused for every matching call.
 */
export function __setResponses(map: Record<string, SupabaseResult | SupabaseResult[]>): void {
  responseQueues = {};
  for (const [key, value] of Object.entries(map)) {
    responseQueues[key] = Array.isArray(value) ? [...value] : [value];
  }
}

/** Clear configured responses and the recorded call log. */
export function __reset(): void {
  responseQueues = {};
  calls.length = 0;
}

function nextResult(table: string, operation: string): SupabaseResult {
  for (const key of [`${table}.${operation}`, table]) {
    const queue = responseQueues[key];
    if (!queue) {
      continue;
    }
    if (queue.length > 1) {
      return queue.shift() as SupabaseResult;
    }
    if (queue.length === 1) {
      // Keep the last entry so it can be reused for repeated calls.
      return queue[0];
    }
  }
  return { data: null, error: null };
}

function createBuilder(entry: RecordedCall) {
  const builder: Record<string, unknown> = {};
  let operationLocked = false;

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      entry.chain.push({ method, args });

      if (DATA_VERBS.has(method)) {
        if (!operationLocked) {
          entry.operation = method as RecordedCall['operation'];
          operationLocked = true;
        }
        if (method === 'insert' || method === 'update') {
          entry.payload = args[0];
        }
      }

      return builder;
    };
  }

  const resolve = () => Promise.resolve(nextResult(entry.table, entry.operation));

  builder.single = () => resolve();
  builder.maybeSingle = () => resolve();
  builder.then = (
    onFulfilled?: (value: SupabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => resolve().then(onFulfilled, onRejected);

  return builder;
}

export const supabase = {
  from: jest.fn((table: string) => {
    const entry: RecordedCall = { table, operation: 'select', payload: undefined, chain: [] };
    calls.push(entry);
    return createBuilder(entry);
  }),
};

export const isSupabaseConfigured = true;
