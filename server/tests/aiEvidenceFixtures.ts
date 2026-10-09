/** Decode either model evidence format for semantic contract assertions. */
export function parseSearchEvidence(content: string) {
  const payload = JSON.parse(content);
  if (payload.sources) return payload;
  return {
    ...payload,
    sources: payload.rows.map((row: unknown[]) =>
      Object.fromEntries(
        payload.columns.map((column: string, index: number) => [column, row[index]])
      )
    ),
  };
}
