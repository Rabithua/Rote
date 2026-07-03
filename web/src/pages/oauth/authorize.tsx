import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import { Button } from '@/components/ui/button';
import { authService } from '@/utils/auth';
import { getCurrentRedirectPath, getLoginPathWithRedirect } from '@/utils/loginRedirect';
import {
  getOAuthAuthorizeSession,
  submitOAuthAuthorizeDecision,
  type OAuthAuthorizeSession,
} from '@/utils/oauthMcpApi';
import { Check, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

function getScopeLabelKey(scope: string) {
  return scope.replaceAll(':', '_');
}

const OAUTH_SCOPE_GROUPS = [
  {
    key: 'notes',
    scopes: ['notes:read', 'notes:write', 'notes:delete'],
  },
  {
    key: 'articles',
    scopes: ['articles:read', 'articles:write', 'articles:delete'],
  },
  {
    key: 'reactions',
    scopes: ['reactions:write', 'reactions:delete'],
  },
  {
    key: 'profile',
    scopes: ['profile:read', 'profile:write'],
  },
  {
    key: 'data',
    scopes: ['stats:read'],
  },
  {
    key: 'settings',
    scopes: ['settings:read', 'settings:write'],
  },
  {
    key: 'attachments',
    scopes: ['attachments:write', 'attachments:delete', 'video:upload'],
  },
] as const;

export default function OAuthAuthorizePage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.oauthAuthorize' });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId');
  const [session, setSession] = useState<OAuthAuthorizeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scopeLabels = useMemo(
    () =>
      Object.fromEntries(
        session?.scopes.map((scope) => [
          scope,
          t(`scopes.${getScopeLabelKey(scope)}`, { defaultValue: scope }),
        ]) || []
      ),
    [session?.scopes, t]
  );

  const permissionGroups = useMemo(() => {
    const scopes = session?.scopes || [];
    const handledScopes = new Set<string>();
    const groups: Array<{ key: string; scopes: string[] }> = OAUTH_SCOPE_GROUPS.map((group) => {
      const groupScopes = group.scopes.filter((scope) => scopes.includes(scope));
      groupScopes.forEach((scope) => handledScopes.add(scope));
      return {
        key: group.key,
        scopes: groupScopes,
      };
    }).filter((group) => group.scopes.length > 0);

    const otherScopes = scopes.filter((scope) => !handledScopes.has(scope));
    if (otherScopes.length > 0) {
      groups.push({
        key: 'other',
        scopes: otherScopes,
      });
    }

    return groups;
  }, [session?.scopes]);

  useEffect(() => {
    if (!requestId) {
      setError(t('errors.missingRequest'));
      setLoading(false);
      return;
    }

    if (!authService.hasValidAccessToken() && !authService.hasValidRefreshToken()) {
      navigate(getLoginPathWithRedirect(getCurrentRedirectPath()), { replace: true });
      return;
    }

    setLoading(true);
    getOAuthAuthorizeSession(requestId)
      .then((data) => {
        setSession(data);
        setError(null);
      })
      .catch((err: any) => {
        if (err?.response?.status === 401) {
          navigate(getLoginPathWithRedirect(getCurrentRedirectPath()), { replace: true });
          return;
        }
        setError(err?.response?.data?.message || err?.message || t('errors.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [navigate, requestId, t]);

  async function submit(decision: 'approve' | 'deny') {
    if (!requestId) return;
    setSubmitting(decision);
    try {
      const result = await submitOAuthAuthorizeDecision(requestId, decision);
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t('errors.submitFailed'));
      setSubmitting(null);
    }
  }

  if (loading) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  if (error || !session) {
    return (
      <main className="bg-background flex min-h-dvh items-center justify-center px-4">
        <section className="border-border w-full max-w-md rounded-lg border p-6">
          <div className="flex items-center gap-3">
            <X className="text-destructive size-5" />
            <h1 className="text-lg font-semibold">{t('errorTitle')}</h1>
          </div>
          <p className="text-muted-foreground mt-3 text-sm">{error || t('errors.loadFailed')}</p>
          <Button className="mt-5 w-full" onClick={() => navigate('/home')}>
            {t('backHome')}
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-6">
      <section className="border-border w-full max-w-xl rounded-lg border p-6">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-md">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('subtitle', { client: session.client.clientName })}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase">{t('client')}</div>
            <div className="mt-1 font-medium">{session.client.clientName}</div>
            {session.client.clientUri && (
              <Link
                className="text-primary mt-1 inline-flex items-center gap-1 text-sm"
                target="_blank"
                rel="noopener noreferrer"
                to={session.client.clientUri}
              >
                {session.client.clientUri}
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>

          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase">
              {t('permissions')}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('permissionsDescription', { count: session.scopes.length })}
            </p>
            <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
              {permissionGroups.map((group) => (
                <section key={group.key} className="border-border/70 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">{t(`permissionGroups.${group.key}`)}</h2>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {t('permissionCount', { count: group.scopes.length })}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="bg-muted/60 text-foreground flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 select-none"
                      >
                        <Check className="text-primary size-3.5 shrink-0" />
                        <span>{scopeLabels[scope]}</span>
                      </span>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase">
              {t('resource')}
            </div>
            <p className="mt-1 text-sm break-all">{session.resource}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" disabled={Boolean(submitting)} onClick={() => submit('deny')}>
            {submitting === 'deny' ? t('denying') : t('deny')}
          </Button>
          <Button disabled={Boolean(submitting)} onClick={() => submit('approve')}>
            {submitting === 'approve' ? t('approving') : t('approve')}
          </Button>
        </div>
      </section>
    </main>
  );
}
