import { Profile } from "@/types/main";
import { useAtomValue, useAtom } from "jotai/react";
import { atomWithStorage, loadable } from "jotai/utils";

export const profileAtom = atomWithStorage<Profile | null>("profile", null);

const loadaleProfileAtom = loadable(profileAtom);

export function useProfileOnlyRead() {
  return useAtomValue(profileAtom);
}

export function useProfile() {
  return useAtom(profileAtom);
}

export function useProfileLoadable() {
  return useAtomValue(loadaleProfileAtom);
}
