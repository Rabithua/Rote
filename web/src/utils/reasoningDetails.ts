export type ReasoningDetail = {
  type: string;
  index?: number;
  id?: string | null;
  [key: string]: unknown;
};

export function normalizeReasoningDetails(value: unknown): ReasoningDetail[] {
  return Array.isArray(value)
    ? value.filter(
        (detail): detail is ReasoningDetail =>
          !!detail && typeof detail === 'object' && typeof detail.type === 'string'
      )
    : [];
}

// OpenRouter's signed/encrypted blocks must survive the assistant -> tool -> assistant round.
export class ReasoningDetailsAccumulator {
  private blocks: ReasoningDetail[] = [];

  append(value: unknown): void {
    for (const delta of normalizeReasoningDetails(value)) {
      const existing = this.blocks.find((block) =>
        typeof delta.index === 'number'
          ? block.index === delta.index
          : !!delta.id && block.id === delta.id
      );
      if (!existing) {
        this.blocks.push({ ...delta });
        continue;
      }
      for (const [field, fragment] of Object.entries(delta)) {
        if (
          ['text', 'summary', 'data', 'signature'].includes(field) &&
          typeof fragment === 'string'
        ) {
          existing[field] = (typeof existing[field] === 'string' ? existing[field] : '') + fragment;
        } else if (fragment !== null || existing[field] === undefined) {
          existing[field] = fragment;
        }
      }
    }
  }

  fields(): { reasoning_details?: ReasoningDetail[] } {
    return this.blocks.length ? { reasoning_details: this.blocks } : {};
  }
}

export function readReasoningText(delta: {
  reasoning_content?: unknown;
  reasoning?: unknown;
  reasoning_details?: unknown;
}): string {
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content)
    return delta.reasoning_content;
  if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning;
  return normalizeReasoningDetails(delta.reasoning_details)
    .map((detail) =>
      typeof detail.text === 'string'
        ? detail.text
        : typeof detail.summary === 'string'
          ? detail.summary
          : ''
    )
    .join('');
}
