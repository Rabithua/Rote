import { useTags } from "@/state/tags";
import { Link } from "react-router-dom";

export default function TagMap() {
  const tags = useTags();
  return (
    <div className=" flex gap-2 flex-wrap opacity-0 animate-show duration-300">
      {tags.map((item, index) => {
        return (
          <Link
            className=" px-2 py-1 text-xs rounded-md bg-[#00000010] duration-300 hover:scale-95"
            key={`tag_${index}`}
            to={"/filter"}
            state={{
              tags: [item.value],
            }}
          >
            {item.value}
          </Link>
        );
      })}
    </div>
  );
}
