import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';

interface AdminNavigationGuardOptions<T extends string> {
  activeTab: T;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onDiscard: () => void;
  onTabChange: (tab: T) => void;
}

export function useAdminNavigationGuard<T extends string>({
  activeTab,
  hasUnsavedChanges,
  isSaving,
  onDiscard,
  onTabChange,
}: AdminNavigationGuardOptions<T>) {
  const [pendingTab, setPendingTab] = useState<T | null>(null);
  const shouldProtect = hasUnsavedChanges || isSaving;
  const blocker = useBlocker(shouldProtect);

  useEffect(() => {
    if (!shouldProtect) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldProtect]);

  const requestTabChange = (tab: T) => {
    if (tab === activeTab || isSaving) return;
    if (hasUnsavedChanges) setPendingTab(tab);
    else onTabChange(tab);
  };

  const continueEditing = () => {
    setPendingTab(null);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const discardAndLeave = () => {
    if (isSaving) return;
    onDiscard();
    setPendingTab(null);
    if (blocker.state === 'blocked') blocker.proceed();
    else if (pendingTab !== null) onTabChange(pendingTab);
  };

  return {
    requestTabChange,
    dialogProps: {
      open: pendingTab !== null || blocker.state === 'blocked',
      isSaving,
      onContinue: continueEditing,
      onDiscard: discardAndLeave,
    },
  };
}
