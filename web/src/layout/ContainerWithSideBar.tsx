import FloatBtns from '@/components/layout/FloatBtns';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Layers } from 'lucide-react';
import { type ReactNode, useState } from 'react';

function ContainerWithSideBar({
  sidebar,
  sidebarHeader,
  children,
  className,
}: {
  sidebar?: ReactNode;
  sidebarHeader?: ReactNode;
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
        <div
          className="bg-foreground text-primary-foreground block w-fit cursor-pointer rounded-md px-4 py-2 duration-300 hover:scale-105 md:hidden"
          onClick={() => setDrawOpen(!drawOpen)}
        >
          <Layers className="size-4" />
        </div>
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
