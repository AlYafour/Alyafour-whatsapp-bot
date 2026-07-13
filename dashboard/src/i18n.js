import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

const STORAGE_KEY = 'ay-lang';
const stored = localStorage.getItem(STORAGE_KEY);
const initialLang = stored === 'en' ? 'en' : 'ar'; // Arabic is the default

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: initialLang,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function setLanguage(lang) {
  i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

setLanguage(i18n.language);

export default i18n;
