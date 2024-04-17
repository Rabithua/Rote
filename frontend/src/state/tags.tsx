// 使用context加reducer作为全局状态管理系统

import { apiGetMyTags } from "@/api/rote/main";
import { Tag, Tags, TagsAction } from "@/types/main";
import React, { createContext, useContext, useReducer, ReactNode } from "react";

const TagsContext = createContext<Tags | null>(null);
const TagsDispatchContext = createContext<React.Dispatch<TagsAction> | null>(
  null
);

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, dispatch] = useReducer(tagsReducer, initialTags);

  return (
    <TagsContext.Provider value={tags}>
      <TagsDispatchContext.Provider value={dispatch}>
        {children}
      </TagsDispatchContext.Provider>
    </TagsContext.Provider>
  );
}

export function useTags() {
  const context = useContext(TagsContext);
  if (context === null) {
    throw new Error("useTags must be used within a TagsProvider");
  }
  return context;
}

export function useTagsDispatch() {
  const context = useContext(TagsDispatchContext);
  if (context === null) {
    throw new Error("useTagsDispatch must be used within a TagsProvider");
  }
  return context;
}

function tagsReducer(tags: Tags, action: TagsAction): Tags {
  switch (action.type) {
    case "addOne": {
      return [
        ...tags,
        {
          value: action.tag,
          label: action.tag,
        },
      ];
    }
    case "addMore": {
      return [...tags, ...action.tags];
    }
    case "deleted": {
      return tags.filter((t: Tag) => t.value !== action.tag);
    }
    case "freshAll": {
      return tags;
    }
    default: {
      throw new Error("Unknown action: " + action);
    }
  }
}

const initialTags = await apiGetMyTags()
  .then((res) => {
    return res.data.data.map((item: any) => {
      return {
        value: item,
        label: item,
      };
    });
  })
  .catch((err: any) => {
    return [];
  });
