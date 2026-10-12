const normalizeStatus = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/s$/, "");

/**
 * The list with the same status name, ignoring case, punctuation and a plural "s"
 * (so a pipeline "Seminarian" column matches the archive's "Seminarians").
 */
export function findMatchingList<T extends { name: string }>(
  lists: T[],
  name: string | undefined,
): T | undefined {
  if (!name) return undefined;
  const key = normalizeStatus(name);
  return lists.find((list) => normalizeStatus(list.name) === key);
}
