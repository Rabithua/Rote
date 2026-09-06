import { Toaster } from '@/components/ui/sonner';
import { getHttpStatus } from '@/utils/error';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import React from 'react';
import { SWRConfig } from 'swr';
import { ThemeProvider } from './components/theme-provider';
import GlobalRouterProvider from './route/main';

const AppWrapper = () => (
  <React.StrictMode>
    <HelmetProvider>
      <SWRConfig
        value={{
          onErrorRetry: (error, key, _config, _revalidate, { retryCount }) => {
            const status = getHttpStatus(error);
            if (status && [404, 401, 403].includes(status)) return;
            if (key === 'profile') return;
            if (retryCount >= 3) return;
          },
        }}
      >
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <GlobalRouterProvider />
        </ThemeProvider>
        <Toaster position="top-right" />
      </SWRConfig>
    </HelmetProvider>
  </React.StrictMode>
);

export default AppWrapper;
