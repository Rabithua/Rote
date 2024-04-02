// 使用context加reducer作为全局状态管理系统

import { OpenKey, OpenKeys, OpenKeysAction } from "@/types/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const OpenKeysContext = createContext<OpenKeys | null>(null);
const OpenKeysDispatchContext =
  createContext<React.Dispatch<OpenKeysAction> | null>(null);

export function OpenKeysProvider({ children }: { children: ReactNode }) {
  const [openKeys, dispatch] = useReducer(openKeysReducer, initialOpenKeys);

  return (
    <OpenKeysContext.Provider value={openKeys}>
      <OpenKeysDispatchContext.Provider value={dispatch}>
        {children}
      </OpenKeysDispatchContext.Provider>
    </OpenKeysContext.Provider>
  );
}

export function useOpenKeys() {
  const context = useContext(OpenKeysContext);
  if (context === null) {
    throw new Error("useOpenKeys must be used within a OpenKeysProvider");
  }
  return context;
}

export function useOpenKeysDispatch() {
  const context = useContext(OpenKeysDispatchContext);
  if (context === null) {
    throw new Error(
      "useOpenKeysDispatch must be used within a OpenKeysProvider"
    );
  }
  return context;
}

function openKeysReducer(openKeys: OpenKeys, action: OpenKeysAction): OpenKeys {
  switch (action.type) {
    case "addMore": {
      return [...openKeys, ...action.openKeys];
    }
    case "init": {
      return [...action.openKeys];
    }

    case "addOne": {
      return [...openKeys, action.openKey];
    }

    case "delete": {
      return openKeys.filter(
        (openKey: OpenKey) => !action.openKeyid.includes(openKey.id)
      );
    }

    case "updateOne": {
      return openKeys.map((openKey: OpenKey) =>
        openKey.id === action.openKey.id ? action.openKey : openKey
      );
    }

    default: {
      throw new Error("Unknown action: " + action);
    }
  }
}

const initialOpenKeys = [] as OpenKeys;
