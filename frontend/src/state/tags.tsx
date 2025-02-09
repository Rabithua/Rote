import { apiGetMyTags } from "@/api/rote/main";
import { Tags } from "@/types/main";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect } from "react";

const tagsAtom = atomWithStorage<Tags>("tags", []);

export function useTags(): [Tags, (tags: Tags) => void] {
  const [tags, setTags] = useAtom(tagsAtom);

  useEffect(() => {
    if (tags.length > 0) {
      return;
    }
    fetchTags()
      .then((newTags) => {
        setTags(newTags);
      })
      .catch(console.error);
  }, []);

  return [tags, setTags];
}

export async function fetchTags() {
  try {
    const res = await apiGetMyTags();
    return res.data.data.map((item: any) => ({
      value: item,
      label: item,
    }));
  } catch (err) {
    return [];
  }
}
