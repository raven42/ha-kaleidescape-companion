/** English count labels, including explicit irregular plurals such as entries. */
export function counted(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
