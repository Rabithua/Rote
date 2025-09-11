import { atom, useAtom } from 'jotai';

const showLeftNavAtom = atom(true);

export function useShowLeftNav() {
  return useAtom(showLeftNavAtom);
}
