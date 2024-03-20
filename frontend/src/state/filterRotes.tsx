// 使用context加reducer作为全局状态管理系统

import { Rote, Rotes, RotesAction } from "@/types/main";
import { sortRotesByPinAndUpdatedAt } from "@/utils/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const FilterRotesContext = createContext<Rotes | null>(null);
const FilterRotesDispatchContext = createContext<React.Dispatch<RotesAction> | null>(
  null
);

export function FilterRotesProvider({ children }: { children: ReactNode }) {
  const [rotes, dispatch] = useReducer(filterRotesReducer, initialRotes);

  return (
    <FilterRotesContext.Provider value={rotes}>
      <FilterRotesDispatchContext.Provider value={dispatch}>
        {children}
      </FilterRotesDispatchContext.Provider>
    </FilterRotesContext.Provider>
  );
}

export function useFilterRotes() {
  const context = useContext(FilterRotesContext);
  if (context === null) {
    throw new Error("useFilterRotes must be used within a FilterRotesProvider");
  }
  return context;
}

export function useFilterRotesDispatch() {
  const context = useContext(FilterRotesDispatchContext);
  if (context === null) {
    throw new Error("useFilterRotesDispatch must be used within a FilterRotesProvider");
  }
  return context;
}

function filterRotesReducer(rotes: Rotes, action: RotesAction): Rotes {
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
