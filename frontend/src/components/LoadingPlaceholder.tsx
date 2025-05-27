import { Loader } from "lucide-react";
import RandomCat from "./RandomCat";

export default function LoadingPlaceholder(
  { className, size, error }: {
    className?: string;
    size?: number;
    error?: any;
  },
) {
  return (
    <div
      className={`dark:text-white flex justify-center items-center ${className}`}
    >
      {error
        ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <RandomCat />
            <div className="font-thin">Error:{error.message}</div>
          </div>
        )
        : <Loader className={` animate-spin size-${size || 6}`} />}
    </div>
  );
}
