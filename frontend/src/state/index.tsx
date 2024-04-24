import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";
import { FilterRotesProvider } from "./filterRotes";
import { OpenKeysProvider } from "./openKeys";
import { ExploreRotesProvider } from "./exploreRotes";
import { ArchivedRotesProvider } from "./archivedRotes";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>
          <FilterRotesProvider>
            <ExploreRotesProvider>
              <ArchivedRotesProvider>
                <OpenKeysProvider>{children}</OpenKeysProvider>
              </ArchivedRotesProvider>
            </ExploreRotesProvider>
          </FilterRotesProvider>
        </TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
