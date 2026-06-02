import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

/**
 * Renders a <select> that lets the user switch the active language.
 * Only English is available now, but adding a new locale is a one-liner:
 *   1. Add the JSON file under src/i18n/locales/<code>.json
 *   2. Register it in src/i18n/index.ts
 *   3. Push { code, label } to SUPPORTED_LANGUAGES
 */
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    i18n.changeLanguage(e.target.value as SupportedLanguage);
  }

  return (
    <select
      value={i18n.resolvedLanguage}
      onChange={handleChange}
      aria-label={t('languageSwitcher.ariaLabel')}
      style={{
        background: '#1e293b',
        color: '#f8fafc',
        border: '1px solid #334155',
        borderRadius: '0.375rem',
        padding: '0.25rem 0.5rem',
        fontSize: '0.875rem',
        cursor: 'pointer',
      }}
    >
      {SUPPORTED_LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
