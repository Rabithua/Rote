import type { TempState } from "@/types/main";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const tempState = atomWithStorage<TempState>("tempState", {
  // just send the new one
  sendNewOne: null,
  // just edit the one
  editOne: null,
  removeOne: null,
  newAttachments: null
});

export function useTempState(): [TempState, (data: TempState) => void] {
  const [temp, setTemp] = useAtom(tempState);
  return [temp, setTemp];
}
