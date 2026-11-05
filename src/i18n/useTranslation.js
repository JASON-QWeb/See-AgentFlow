import { createContext, useCallback, useContext } from 'react';
import { translate } from './catalog.js';

export const LanguageContext = createContext('en');
export function useTranslation(selected) {
  const context = useContext(LanguageContext), language = selected || context;
  return useCallback((message, values) => translate(language, message, values), [language]);
}
