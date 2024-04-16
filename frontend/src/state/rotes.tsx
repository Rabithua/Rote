// 使用context加reducer作为全局状态管理系统

import { apiGetMyRote } from "@/api/rote/main";
import { Rote, Rotes, RotesAction } from "@/types/main";
import { sortRotesByPinAndUpdatedAt } from "@/utils/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const RotesContext = createContext<Rotes | null>(null);
const RotesDispatchContext = createContext<React.Dispatch<RotesAction> | null>(
  null
);

export function RotesProvider({ children }: { children: ReactNode }) {
  const [rotes, dispatch] = useReducer(rotesReducer, []);

  return (
    <RotesContext.Provider value={rotes}>
      <RotesDispatchContext.Provider value={dispatch}>
        {children}
      </RotesDispatchContext.Provider>
    </RotesContext.Provider>
  );
}

export function useRotes() {
  const context = useContext(RotesContext);
  if (context === null) {
    throw new Error("useRotes must be used within a RotesProvider");
  }
  return context;
}

export function useRotesDispatch() {
  const context = useContext(RotesDispatchContext);
  if (context === null) {
    throw new Error("useRotesDispatch must be used within a RotesProvider");
  }
  return context;
}

function rotesReducer(rotes: Rotes, action: RotesAction): Rotes {
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
