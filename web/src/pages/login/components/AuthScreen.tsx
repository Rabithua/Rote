import Logo from '@/components/others/logo';
import type { ReactNode } from 'react';
import '../auth-screen.css';

export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen bg-pattern bg-background text-foreground">
      <div className="auth-screen-grid">
        <div className="auth-screen-band auth-screen-space auth-screen-top" aria-hidden="true">
          <div />
          <div className="auth-screen-column" />
          <div />
        </div>

        <header className="auth-screen-band auth-screen-brand">
          <div className="auth-screen-decoration" aria-hidden="true" />
          <div className="auth-screen-column bg-background px-6 py-3">
            <Logo className="h-auto w-32" color="#3ECF4A" />
          </div>
          <div className="auth-screen-decoration" aria-hidden="true" />
        </header>

        <div className="auth-screen-band auth-screen-body">
          <div className="auth-screen-decoration" aria-hidden="true" />
          <main className="auth-screen-column auth-screen-content bg-background px-6 py-8">
            {children}
          </main>
          <div className="auth-screen-decoration" aria-hidden="true" />
        </div>

        <div className="auth-screen-band auth-screen-space auth-screen-bottom" aria-hidden="true">
          <div />
          <div className="auth-screen-column" />
          <div />
        </div>
      </div>
    </div>
  );
}
