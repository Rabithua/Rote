import { Loader } from "lucide-react";

export default function LoadingPlaceholder(
  { className, size }: { className?: string; size?: number },
) {
  return (
    <div
      className={`dark:text-white flex justify-center items-center ${className}`}
    >
      <Loader className={` animate-spin size-${size || 6}`} />
    </div>
  );
}
