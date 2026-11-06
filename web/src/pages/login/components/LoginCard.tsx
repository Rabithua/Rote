import type { ReactNode } from 'react';

export function LoginCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted w-full rounded-lg p-1">
      <div className="bg-background rounded-sm p-4">{children}</div>
    </div>
  );
}
