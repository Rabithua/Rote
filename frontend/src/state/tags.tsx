// 使用context加reducer作为全局状态管理系统

import { apiGetMyTags } from "@/api/rote/main";
import { Tag, Tags, TagsAction } from "@/types/main";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";

const TagsContext = createContext<Tags | null>(null);
const TagsDispatchContext = createContext<React.Dispatch<TagsAction> | null>(
  null
);

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tags, dispatch] = useReducer(tagsReducer, []);

  useEffect(() => {
    async function fetchTags() {
      try {
        const res = await apiGetMyTags();
        dispatch({
          type: "freshAll",
          tags: res.data.data.map((item: any) => {
            return {
              value: item,
              label: item,
            };
          }),
        });
      } catch (err) {
        console.error("Failed to fetch tags:", err);
        dispatch({ type: "freshAll", tags: [] });
      }
    }

    fetchTags();
  }, []);

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
      return [...tags, action.tag];
    }
    case "addMore": {
      return [...tags, ...action.tags];
    }
    case "deleted": {
      return tags.filter((t: Tag) => t.value !== action.tag.value);
    }
    case "freshAll": {
      return action.tags;
    }
    default: {
      throw new Error("Unknown action: " + action);
    }
  }
}
