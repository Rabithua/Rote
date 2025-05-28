import { Loader } from 'lucide-react';
import RandomCat from './RandomCat';

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
          <RandomCat />
          <div className="font-thin">Error:{error.message}</div>
        </div>
      ) : (
        <Loader className={`animate-spin size-${size || 6}`} />
      )}
    </div>
  );
}
