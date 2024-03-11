import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>{children}</TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
