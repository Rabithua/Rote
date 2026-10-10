import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildChatParameters, type ReasoningEffort } from '@/utils/chatParameters';
import { useTranslation } from 'react-i18next';

export function ReasoningEffortSelect({
  id,
  model,
  local = false,
  value = 'high',
  onChange,
}: {
  id: string;
  model: string;
  local?: boolean;
  value?: ReasoningEffort | null;
  onChange: (value: ReasoningEffort | null) => void;
}) {
  const { t } = useTranslation('translation', { keyPrefix: 'aiProvider.reasoningEffort' });
  const effort = local
    ? undefined
    : buildChatParameters({ model, reasoningEffort: value }, 0.2).reasoning_effort;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('label')}</Label>
      <Select
        value={value ?? 'omit'}
        onValueChange={(next) => onChange(next === 'omit' ? null : (next as ReasoningEffort))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">{t('low')}</SelectItem>
          <SelectItem value="medium">{t('medium')}</SelectItem>
          <SelectItem value="high">{t('high')}</SelectItem>
          <SelectItem value="omit">{t('omit')}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{t('description')}</p>
      <p className="text-muted-foreground text-xs" role="status">
        {effort ? t('effective', { effort }) : t('notSent')}
      </p>
    </div>
  );
}
