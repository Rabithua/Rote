// 使用context加reducer作为全局状态管理系统

import { Rote, Rotes, RotesAction } from "@/types/main";
import { sortRotesByPinAndUpdatedAt } from "@/utils/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const ExploreRotesContext = createContext<Rotes | null>(null);
const ExploreRotesDispatchContext =
  createContext<React.Dispatch<RotesAction> | null>(null);

export function ExploreRotesProvider({ children }: { children: ReactNode }) {
  const [rotes, dispatch] = useReducer(exploreRotesReducer, initialRotes);

  return (
    <ExploreRotesContext.Provider value={rotes}>
      <ExploreRotesDispatchContext.Provider value={dispatch}>
        {children}
      </ExploreRotesDispatchContext.Provider>
    </ExploreRotesContext.Provider>
  );
}

export function useExploreRotes() {
  const context = useContext(ExploreRotesContext);
  if (context === null) {
    throw new Error(
      "useExploreRotes must be used within a ExploreRotesProvider"
    );
  }
  return context;
}

export function useExploreRotesDispatch() {
  const context = useContext(ExploreRotesDispatchContext);
  if (context === null) {
    throw new Error(
      "useExploreRotesDispatch must be used within a ExploreRotesProvider"
    );
  }
  return context;
}

function exploreRotesReducer(rotes: Rotes, action: RotesAction): Rotes {
  switch (action.type) {
    case "add": {
      const rotes_unOrder = [...rotes, ...action.rotes];
      return sortRotesByPinAndUpdatedAt(rotes_unOrder);
    }

    case "addOne": {
      const rotes_unOrder = [...rotes, action.rote];
      return sortRotesByPinAndUpdatedAt(rotes_unOrder);
    }

    case "deleted": {
      return rotes.filter((rote: Rote) => !action.roteid.includes(rote.id));
    }

    case "freshAll": {
      return action.rotes;
    }

    case "updateOne": {
      // 替换rotes中rote.id与action.rote.id相同的对象，替换为action.rotr
      return sortRotesByPinAndUpdatedAt(
        rotes.map((rote: Rote) =>
          rote.id === action.rote.id ? action.rote : rote
        )
      );
    }

    default: {
      throw new Error("Unknown action: " + action);
    }
  }
}

const initialRotes = [] as Rotes;
