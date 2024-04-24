// 使用context加reducer作为全局状态管理系统

import { Rote, Rotes, RotesAction } from "@/types/main";
import { sortRotesByPinAndCreatedAt } from "@/utils/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const ArchivedRotesContext = createContext<Rotes | null>(null);
const ArchivedRotesDispatchContext =
  createContext<React.Dispatch<RotesAction> | null>(null);

export function ArchivedRotesProvider({ children }: { children: ReactNode }) {
  const [rotes, dispatch] = useReducer(archivedRotesReducer, initialRotes);

  return (
    <ArchivedRotesContext.Provider value={rotes}>
      <ArchivedRotesDispatchContext.Provider value={dispatch}>
        {children}
      </ArchivedRotesDispatchContext.Provider>
    </ArchivedRotesContext.Provider>
  );
}

export function useArchivedRotes() {
  const context = useContext(ArchivedRotesContext);
  if (context === null) {
    throw new Error(
      "useArchivedRotes must be used within a ArchivedRotesProvider"
    );
  }
  return context;
}

export function useArchivedRotesDispatch() {
  const context = useContext(ArchivedRotesDispatchContext);
  if (context === null) {
    throw new Error(
      "useArchivedRotesDispatch must be used within a ArchivedRotesProvider"
    );
  }
  return context;
}

function archivedRotesReducer(rotes: Rotes, action: RotesAction): Rotes {
  switch (action.type) {
    case "add": {
      const rotes_unOrder = [...rotes, ...action.rotes];
      return sortRotesByPinAndCreatedAt(rotes_unOrder);
    }

    case "addOne": {
      const rotes_unOrder = [...rotes, action.rote];
      return sortRotesByPinAndCreatedAt(rotes_unOrder);
    }

    case "deleted": {
      return rotes.filter((rote: Rote) => !action.roteid.includes(rote.id));
    }

    case "freshAll": {
      return action.rotes;
    }

    case "updateOne": {
      // 替换rotes中rote.id与action.rote.id相同的对象，替换为action.rotr
      return sortRotesByPinAndCreatedAt(
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
