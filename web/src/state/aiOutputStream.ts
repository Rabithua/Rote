import type { AiMemoryMessage } from '@/state/aiChat';
import type {
  AiOutputDelta,
  AiOutputFinished,
  AiOutputStarted,
  AiThinkingPhase,
} from '@/utils/aiTypes';

type Output = NonNullable<AiMemoryMessage['outputs']>[number];
type PendingOutput = AiOutputStarted & {
  text: string[];
  thinking: string[];
  thinkingPhase?: AiThinkingPhase;
};

/** Owns the ordered output blocks and batches provider fragments once per frame. */
export function createAiOutputStream(params: {
  updateMessage: (updater: (message: AiMemoryMessage) => AiMemoryMessage) => void;
  isActive: () => boolean;
  firstToken: () => number;
}) {
  const pending = new Map<string, PendingOutput>();
  let frame: number | undefined;

  const flush = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    const updates = Array.from(pending.values());
    pending.clear();
    if (!updates.length || !params.isActive()) return;
    params.updateMessage((message) => {
      const outputs = [...(message.outputs || [])];
      for (const update of updates) {
        const index = outputs.findIndex((output) => output.outputId === update.outputId);
        const existing = index >= 0 ? outputs[index] : undefined;
        const next: Output = {
          ...existing,
          outputId: update.outputId,
          phase: existing?.phase || update.phase,
          text: (existing?.text || '') + update.text.join(''),
          thinking: (existing?.thinking || '') + update.thinking.join(''),
          thinkingPhase: update.thinkingPhase || existing?.thinkingPhase,
        };
        if (index >= 0) outputs[index] = next;
        else outputs.push(next);
      }
      return { ...message, outputs };
    });
  };

  const queue = (
    output: AiOutputStarted,
    field: 'text' | 'thinking',
    text: string,
    phase?: AiThinkingPhase
  ) => {
    if (!params.isActive()) return;
    const update = pending.get(output.outputId) || { ...output, text: [], thinking: [] };
    update[field].push(text);
    if (phase) update.thinkingPhase = phase;
    pending.set(output.outputId, update);
    frame ??= window.requestAnimationFrame(flush);
  };

  return {
    flush,
    cancel: () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = undefined;
      pending.clear();
    },
    start: (output: AiOutputStarted) => {
      if (!params.isActive()) return;
      flush();
      params.updateMessage((message) => ({
        ...message,
        outputs: message.outputs?.some((item) => item.outputId === output.outputId)
          ? message.outputs
          : [...(message.outputs || []), output],
      }));
    },
    text: (output: AiOutputDelta) => {
      if (!params.isActive()) return;
      params.firstToken();
      queue(output, 'text', output.text);
    },
    thinking: (outputId: string, phase: AiThinkingPhase, text: string) =>
      queue(
        {
          outputId,
          phase:
            phase === 'answer'
              ? 'answering'
              : phase === 'route_decision'
                ? 'planning'
                : 'tool_calling',
        },
        'thinking',
        text,
        phase
      ),
    finish: (finished: AiOutputFinished) => {
      if (!params.isActive()) return;
      flush();
      params.updateMessage((message) => {
        let content = message.content;
        const outputs = message.outputs?.map((output) => {
          if (output.outputId !== finished.outputId) return output;
          if (output.kind === 'answer') return output;
          if (finished.kind === 'process') return { ...output, kind: finished.kind };
          const { text, ...metadata } = output;
          content = text || '';
          return {
            ...metadata,
            kind: finished.kind,
            phase: 'answering' as const,
            status: { type: 'phase' as const, phase: 'answering' as const },
          };
        });
        return { ...message, content, outputs };
      });
    },
  };
}
