export const fileReference = (id: string) => `pact-file:${id}`;
export function referencedFileId(value: string): string | null {
  return (
    /^pact-file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      value,
    )?.[1] ?? null
  );
}
