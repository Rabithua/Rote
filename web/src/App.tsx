import { Toaster } from '@/components/ui/sonner';
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
            if ([404, 401, 403].includes(error.status)) return;
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
