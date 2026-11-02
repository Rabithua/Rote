import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminSettingsDraft } from '../settings/useAdminSettingsDraft';
import AutosaveFeedback from './AutosaveFeedback';
import type { AutosaveStatus } from './useUiAutosave';

interface AutosaveNumberFieldProps {
  id: string;
  label: string;
  description: string;
  value: number;
  minimum: number;
  validationKey: 'invalidRateLimit' | 'invalidVideoLimit';
  status?: AutosaveStatus;
  onCommit: (value: number) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
}
export default function AutosaveNumberField({
  id,
  label,
  description,
  value,
  minimum,
  validationKey,
  status,
  onCommit,
  onDirtyChange,
}: AutosaveNumberFieldProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.autosave' });
  const form = useAdminSettingsDraft(String(value));
  const [invalid, setInvalid] = useState(false);
  const isSaving = status?.state === 'saving';
  useEffect(() => {
    onDirtyChange(form.isDirty);
  }, [form.isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const commit = async () => {
    if (isSaving || !form.isDirty) return;
    const submitted = form.value;
    const number = Number(submitted);
    if (!submitted.trim() || !Number.isInteger(number) || number < minimum) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (await onCommit(number)) form.markSaved(submitted, String(number));
  };
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={minimum}
        step="1"
        value={form.value}
        disabled={isSaving}
        aria-invalid={invalid}
        aria-describedby={`${id}-description${invalid ? ` ${id}-error` : ''}`}
        onChange={(event) => {
          form.setValue(event.target.value);
          setInvalid(false);
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }
        }}
      />
      <p id={`${id}-description`} className="text-muted-foreground text-xs">
        {description}
      </p>
      {invalid && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {t(validationKey)}
        </p>
      )}
      <AutosaveFeedback
        status={form.isDirty && status?.state === 'saved' ? undefined : status}
        onRetry={() => void commit()}
      />
    </div>
  );
}
