import { EditorType } from "@/types/main";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const editorAtom = atomWithStorage<EditorType>("editor", {
  content: "",
  tags: [],
  state: "private",
  archived: false,
  pin: false,
  type: "rote",
});

export function useEditor(): [EditorType, (editor: EditorType) => void] {
  const [editor, setEditor] = useAtom(editorAtom);

  return [editor, setEditor];
}
