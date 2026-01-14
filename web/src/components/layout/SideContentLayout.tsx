import type { ReactNode } from 'react';

export function SideContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative hidden w-72 shrink-0 md:block">
      <div className="noScrollBar fixed top-0 hidden h-dvh w-72 divide-y overflow-y-scroll md:block">
        {children}
      </div>
    </div>
  );
}
