import { OpenKeys } from "@/types/main";
import { atom, useAtom } from "jotai";

const openKeysAtom = atom<OpenKeys>([]);

export function useOpenKeys() {
  return useAtom(openKeysAtom);
}
