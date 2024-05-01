// 使用context加reducer作为全局状态管理系统

import { Rote, Rotes, RotesAction } from "@/types/main";
import { sortRotesByPinAndCreatedAt } from "@/utils/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const TempRotesContext = createContext<Rotes | null>(null);
const TempRotesDispatchContext =
  createContext<React.Dispatch<RotesAction> | null>(null);

export function TempRotesProvider({ children }: { children: ReactNode }) {
  const [rotes, dispatch] = useReducer(tempRotesReducer, initialRotes);

  return (
    <TempRotesContext.Provider value={rotes}>
      <TempRotesDispatchContext.Provider value={dispatch}>
        {children}
      </TempRotesDispatchContext.Provider>
    </TempRotesContext.Provider>
  );
}

export function useTempRotes() {
  const context = useContext(TempRotesContext);
  if (context === null) {
    throw new Error("useTempRotes must be used within a TempRotesProvider");
  }
  return context;
}

export function useTempRotesDispatch() {
  const context = useContext(TempRotesDispatchContext);
  if (context === null) {
    throw new Error(
      "useTempRotesDispatch must be used within a TempRotesProvider"
    );
  }
  return context;
}

function tempRotesReducer(rotes: Rotes, action: RotesAction): Rotes {
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
