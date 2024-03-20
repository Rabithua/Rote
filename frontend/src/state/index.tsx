import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";
import { FilterRotesProvider } from "./filterRotes";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>
          <FilterRotesProvider>{children}</FilterRotesProvider>
        </TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
