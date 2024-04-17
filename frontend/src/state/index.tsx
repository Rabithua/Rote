import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";
import { FilterRotesProvider } from "./filterRotes";
import { OpenKeysProvider } from "./openKeys";
import { ExploreRotesProvider } from "./exploreRotes";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>
          <FilterRotesProvider>
            <ExploreRotesProvider>
              <OpenKeysProvider>{children}</OpenKeysProvider>
            </ExploreRotesProvider>
          </FilterRotesProvider>
        </TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
