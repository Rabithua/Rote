import FloatBtns from '@/components/layout/FloatBtns';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { Layers } from 'lucide-react';
import { type ReactNode, useState } from 'react';

function ContainerWithSideBar({
  sidebar,
  sidebarHeader,
  floatButtons,
  children,
  className,
  hideSidebarToggleButton,
  hideFloatBtnsOnMobile,
  viewport = false,
  scrollContainerName,
}: {
  sidebar?: ReactNode;
  sidebarHeader?: ReactNode;
  floatButtons?: ReactNode;
  children?: ReactNode;
  className?: string;
  hideSidebarToggleButton?: boolean;
  hideFloatBtnsOnMobile?: boolean;
  viewport?: boolean;
  scrollContainerName?: string;
}) {
  const [drawOpen, setDrawOpen] = useState(false);

  return (
    <div
      data-viewport-layout={viewport || undefined}
      className={cn(
        'flex min-h-screen md:divide-x',
        viewport &&
          'h-[calc(100dvh-var(--dashboard-bottom-nav-height,0px))] min-h-0 overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'relative min-w-0 flex-1 divide-y overflow-visible pb-20 sm:pb-0',
          viewport && 'flex min-h-0 flex-col overflow-hidden pb-0'
        )}
      >
        {children}
      </div>

      {(sidebar || sidebarHeader) && (
        <SideContentLayout>
          {sidebarHeader}
          {sidebar && <div className="flex w-full flex-col divide-y">{sidebar}</div>}
        </SideContentLayout>
      )}

      <FloatBtns
        hideOnMobile={hideFloatBtnsOnMobile}
        scrollContainerName={scrollContainerName}
        viewport={viewport}
      >
        {floatButtons}
        {!hideSidebarToggleButton && (
          <Button
            size="icon"
            className="rounded-md shadow-md md:hidden"
            onClick={() => setDrawOpen(!drawOpen)}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Layers className="size-4" />
          </Button>
        )}
      </FloatBtns>

      <Drawer open={drawOpen} onOpenChange={setDrawOpen}>
        <DrawerContent>
          <ScrollArea className="mt-4 h-150 max-h-[60dvh]">
            <div className="mb-24">{sidebar}</div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default ContainerWithSideBar;
