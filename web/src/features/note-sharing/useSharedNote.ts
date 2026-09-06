import { useEffect, useState } from 'react';
import { getHttpStatus } from '@/utils/error';
import { getSharedNote } from './api';
import type { SharedNote } from './types';

type SharedNoteState =
  | { status: 'loading' | 'missing' | 'error'; note?: never }
  | { status: 'ready'; note: SharedNote };

// Deliberately local to the page: shared content and tokens must not enter the
// account's SWR cache or offline persistence.
export function useSharedNote(token: string) {
  const [state, setState] = useState<SharedNoteState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setState({ status: 'loading' });
      try {
        const note = await getSharedNote(token, request.signal);
        if (!request.signal.aborted) setState({ status: 'ready', note });
      } catch (error) {
        if (!request.signal.aborted) {
          setState({ status: getHttpStatus(error) === 404 ? 'missing' : 'error' });
        }
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void load();
    }
    void load();
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller?.abort();
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, attempt]);

  return { state, retry: () => setAttempt((value) => value + 1) };
}
