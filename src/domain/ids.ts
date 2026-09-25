let counter = 0;

/** Short, sortable-enough ids for client-created records. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}
