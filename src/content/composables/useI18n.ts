import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import enMessages, { type MessageKey } from '../locales/en'
import zhMessages from '../locales/zh'

const messages = {
  en: enMessages,
  zh: zhMessages,
} as const

export function useI18n() {
  const settings = useSettingsStore()

  const t = computed(() => {
    const locale = settings.locale
    const dict = messages[locale]
    return (key: MessageKey, params?: Record<string, string | number>): string => {
      let text = (dict as any)[key] ?? (messages.en as any)[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    }
  })

  return { t }
}
