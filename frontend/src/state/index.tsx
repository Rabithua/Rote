import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";
import { FilterRotesProvider } from "./filterRotes";
import { OpenKeysProvider } from "./openKeys";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>
          <FilterRotesProvider>
            <OpenKeysProvider>{children}</OpenKeysProvider>
          </FilterRotesProvider>
        </TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
