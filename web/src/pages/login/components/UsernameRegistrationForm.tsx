import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

type UsernameRegistrationFormProps = {
  username: string;
  disabled: boolean;
  submitLabel: string;
  busyLabel?: string;
  maxLength?: number;
  hint?: string;
  onUsernameChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function UsernameRegistrationForm({
  username,
  disabled,
  submitLabel,
  busyLabel,
  maxLength = 20,
  hint,
  onUsernameChange,
  onSubmit,
  onBack,
}: UsernameRegistrationFormProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.login' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabled) onSubmit();
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="signup-username">{t('fields.username')}</Label>
        <Input
          id="signup-username"
          autoComplete="username"
          maxLength={maxLength}
          className="text-md rounded-md font-mono"
          value={username}
          disabled={disabled}
          onChange={(event) => onUsernameChange(event.target.value)}
          aria-describedby="signup-username-hint"
        />
        <p id="signup-username-hint" className="text-muted-foreground text-sm">
          {hint || t('entry.usernameHint')}
        </p>
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={disabled}
          onClick={onBack}
        >
          {t('entry.back')}
        </Button>
        <Button type="submit" className="flex-[2]" disabled={disabled} aria-busy={disabled}>
          {disabled && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {disabled ? busyLabel || t('messages.registering') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
