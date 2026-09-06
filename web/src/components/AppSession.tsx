import { Helmet } from '@dr.pogodin/react-helmet';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import { bootstrapAuthAtom } from '@/state/profile';
import CustomHeadScripts from './CustomHeadScripts';
import ScrollPositionManager from './ScrollPositionManager';

// Account bootstrapping, site scripts and persisted navigation state only run
// in the application, never in the independent anonymous share reader.
export default function AppSession() {
  const { data: siteStatus } = useSiteStatus();
  const bootstrapAuth = useSetAtom(bootstrapAuthAtom);
  useEffect(() => {
    void bootstrapAuth();
  }, [bootstrapAuth]);

  return (
    <>
      <Helmet>
        <title>{siteStatus?.site?.name || 'Rote'}</title>
        {siteStatus?.site?.description ? (
          <meta name="description" content={siteStatus.site.description} />
        ) : null}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-startup-image" href="/logo.png" />
      </Helmet>
      <CustomHeadScripts />
      <ScrollPositionManager />
    </>
  );
}
