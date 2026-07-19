import i18n from 'i18next';

type MessageValues = Record<string, string | number>;

export function importMessage(key: string, values: MessageValues = {}): string {
  return i18n.t(`pages.experiment.importData.migration.${key}`, values);
}
