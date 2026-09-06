import type { ReactNode } from 'react';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import LayoutDashboard from '@/layout/dashboard';

export function SharedNoteLayout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <LayoutDashboard anonymousReader>
      <div className="flex min-h-screen min-w-0 md:divide-x">
        <main className="relative min-w-0 flex-1 divide-y pb-20 sm:pb-0">{children}</main>
        <SideContentLayout>{sidebar}</SideContentLayout>
      </div>
    </LayoutDashboard>
  );
}
