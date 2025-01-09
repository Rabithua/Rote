import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const iosSafariToastDoneAtom = atomWithStorage("iosSafariToastDone", false);

export function useIosSafariToastDone() {
  return useAtom(iosSafariToastDoneAtom);
}
