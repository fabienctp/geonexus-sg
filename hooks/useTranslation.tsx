
import { useAppStore } from '../store';
import { TRANSLATIONS } from '../constants';

export const useTranslation = () => {
  const { preferences } = useAppStore();
  const lang = preferences.language || 'en';

  const t = (key: string): string => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return dict[key] || TRANSLATIONS['en'][key] || key;
  };

  return { t, lang };
};
