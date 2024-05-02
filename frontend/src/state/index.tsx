import { ReactNode } from "react";
import { TagsProvider } from "./tags";
import { ProfileProvider } from "./profile";
import { RotesProvider } from "./rotes";
import { FilterRotesProvider } from "./filterRotes";
import { OpenKeysProvider } from "./openKeys";
import { ExploreRotesProvider } from "./exploreRotes";
import { ArchivedRotesProvider } from "./archivedRotes";
import { TempRotesProvider } from "./tempRotes";

export function GlobalContextProvider({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <RotesProvider>
        <TagsProvider>
          <FilterRotesProvider>
            <ExploreRotesProvider>
              <ArchivedRotesProvider>
                <TempRotesProvider>
                  <OpenKeysProvider>{children}</OpenKeysProvider>
                </TempRotesProvider>
              </ArchivedRotesProvider>
            </ExploreRotesProvider>
          </FilterRotesProvider>
        </TagsProvider>
      </RotesProvider>
    </ProfileProvider>
  );
}
