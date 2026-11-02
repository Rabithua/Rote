import isEqual from 'lodash/isEqual';
import { useState } from 'react';

// Keep server refreshes separate from the form until the administrator saves or discards it.
export function useAdminSettingsDraft<T>(source: T) {
  const [state, setState] = useState(() => ({ source, saved: source, value: source }));

  if (!isEqual(source, state.source)) {
    setState({
      source,
      saved: source,
      value: isEqual(state.value, state.saved) ? source : state.value,
    });
  }

  const setValue = (value: T) => setState((current) => ({ ...current, value }));
  const discard = () => setState((current) => ({ ...current, value: current.saved }));
  const markSaved = (submitted: T, persisted: T = submitted) => {
    setState((current) => ({
      ...current,
      saved: persisted,
      value: isEqual(current.value, submitted) ? persisted : current.value,
    }));
  };

  return {
    value: state.value,
    isDirty: !isEqual(state.value, state.saved),
    setValue,
    discard,
    markSaved,
  };
}
