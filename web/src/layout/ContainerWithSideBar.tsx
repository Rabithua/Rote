import FloatBtns from '@/components/layout/FloatBtns';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Layers } from 'lucide-react';
import { type ReactNode, useState } from 'react';

function ContainerWithSideBar({
  sidebar,
  sidebarHeader,
  floatButtons,
  children,
  className,
}: {
  sidebar?: ReactNode;
  sidebarHeader?: ReactNode;
  floatButtons?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const [drawOpen, setDrawOpen] = useState(false);

  return (
    <div className={`flex min-h-screen md:divide-x ${className || ''}`}>
      <div className="relative min-w-0 flex-1 divide-y overflow-visible pb-20 sm:pb-0">
        {children}
      </div>

      {(sidebar || sidebarHeader) && (
        <SideContentLayout>
          {sidebarHeader}
          {sidebar && <div className="sticky top-0 flex w-full flex-col divide-y">{sidebar}</div>}
        </SideContentLayout>
      )}

      <FloatBtns>
        {floatButtons}
        <Button
          size="icon"
          className="rounded-md shadow-md md:hidden"
          onClick={() => setDrawOpen(!drawOpen)}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Layers className="size-4" />
        </Button>
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
