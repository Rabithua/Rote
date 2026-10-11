export function conversationErrorTranslation(detail: string) {
  if (
    ['response_interrupted', 'ai_memory.error.interrupted', 'ai_memory.messages.stopped'].includes(
      detail
    )
  ) {
    return 'messages.interrupted';
  }
  if (detail === 'ai_memory.error.timeout') return 'messages.streamTimeout';
  if (detail.startsWith('ai_memory.')) return 'messages.askFailed';
  return undefined;
}
