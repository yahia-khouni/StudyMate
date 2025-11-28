import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';
import type { SupportedLanguage } from '@/i18n';

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: (i18n.language as SupportedLanguage) || 'en',
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
    }),
    {
      name: 'studyai-language',
      onRehydrateStorage: () => (state) => {
        // Sync i18n with stored language on rehydration
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
