import { Loader, Unplug } from 'lucide-react';

export default function LoadingPlaceholder({
  className,
  size,
  error,
}: {
  className?: string;
  size?: number;
  error?: Error;
}) {
  return (
    <div className={`flex items-center justify-center dark:text-white ${className}`}>
      {error ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <Unplug className={`text-red-500 size-${size || 6}`} />
        </div>
      ) : (
        <Loader className={`animate-spin opacity-40 size-${size || 6}`} />
      )}
    </div>
  );
}
