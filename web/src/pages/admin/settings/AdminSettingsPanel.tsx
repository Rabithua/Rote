import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AdminSettingsPanelProps {
  header: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  isDirty?: boolean;
  saveError?: string | null;
}

export default function AdminSettingsPanel({
  header,
  children,
  actions,
  isDirty = false,
  saveError,
}: AdminSettingsPanelProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.unsavedChanges' });
  const panelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const hasActions = Boolean(actions || isDirty || saveError);

  useLayoutEffect(() => {
    const viewport = panelRef.current?.closest<HTMLElement>('[data-viewport-layout]');
    const actionsElement = actionsRef.current;
    if (!viewport || !actionsElement) return;

    const updateActionsHeight = () => {
      viewport.style.setProperty(
        '--viewport-actions-height',
        `${actionsElement.getBoundingClientRect().height}px`
      );
    };
    updateActionsHeight();
    const observer = new ResizeObserver(updateActionsHeight);
    observer.observe(actionsElement);
    return () => {
      observer.disconnect();
      viewport.style.removeProperty('--viewport-actions-height');
    };
  }, [hasActions]);

  return (
    <div
      ref={panelRef}
      data-slot="admin-settings-panel"
      className="bg-card text-card-foreground flex h-full min-h-0 flex-col"
    >
      <div className="shrink-0 border-b pb-4">{header}</div>
      <div
        id="admin-settings-scroll"
        data-slot="admin-settings-body"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-6"
      >
        {children}
      </div>
      {hasActions && (
        <div
          ref={actionsRef}
          data-slot="admin-settings-actions"
          className="bg-background shrink-0 space-y-3 border-t p-4 sm:px-6"
        >
          {isDirty && <p className="text-muted-foreground text-sm">{t('status')}</p>}
          {saveError && (
            <p role="alert" className="text-destructive text-sm">
              {saveError}
            </p>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
