export class EmbeddingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 409 | 422 | 502 | 503 | 504 = 422,
    public readonly details: Record<string, string | number> = {},
    public readonly retryable = false
  ) {
    super(code);
    this.name = 'EmbeddingError';
  }
}

export function isEmbeddingContractFailure(code: string | null) {
  return (
    code !== null &&
    [
      'embedding_response_invalid',
      'embedding_dimensions_mismatch',
      'embedding_dimensions_limit',
    ].includes(code)
  );
}
