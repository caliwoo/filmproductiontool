import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="language-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
      >
        {t('languageToggle.english')}
      </button>
      <button
        type="button"
        className={lang === 'es' ? 'active' : ''}
        onClick={() => setLang('es')}
      >
        {t('languageToggle.spanish')}
      </button>
    </div>
  );
}
