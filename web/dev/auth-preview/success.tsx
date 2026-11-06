import '@/styles/index.css';
import '@/utils/i18n';
import { ThemeProvider } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { AuthScreen } from '@/pages/login/components/AuthScreen';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import copy from './copy.json';

function AuthenticationPreviewSuccess() {
  const { i18n } = useTranslation();
  const t = copy[i18n.language as keyof typeof copy] ?? copy.zh;

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthScreen>
        <div className="space-y-5">
          <h1 className="text-xl font-medium">{t.success}</h1>
          <p className="text-muted-foreground text-sm">{t.successHint}</p>
          <Button asChild variant="outline" className="w-full">
            <a href="/login?redirect=%2F__auth-preview%2Fsuccess&previewScenario=all">{t.back}</a>
          </Button>
        </div>
      </AuthScreen>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<AuthenticationPreviewSuccess />);
