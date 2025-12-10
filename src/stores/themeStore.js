import { defineStore } from 'pinia'

const STORAGE_KEY = 'ipm-theme-store'

const defaultTheme = {
  // A theme object describes a reusable palette of CSS custom properties.
  // Example shape:
  // {
  //   id: 'default',
  //   name: 'Default Light',
  //   cssVars: {
  //     '--pp-bg': '#f5f7fb',
  //     '--pp-surface': '#ffffff',
  //     '--pp-border': '#d2d7e0',
  //     '--pp-primary': '#2563eb',
  //     '--pp-accent': '#ec4899',
  //     '--pp-text': '#111827',
  //     '--pp-muted-text': '#6b7280',
  //   },
  // }
  id: 'default',
  name: 'Default Light',
  cssVars: {
    '--pp-bg': '#f5f7fb',
    '--pp-surface': '#ffffff',
    '--pp-border': '#d2d7e0',
    '--pp-primary': '#2563eb',
    '--pp-accent': '#ec4899',
    '--pp-text': '#111827',
    '--pp-muted-text': '#6b7280',
  },
}

export const useThemeStore = defineStore('themeStore', {
  state: () => ({
    currentThemeId: defaultTheme.id,
    themes: [defaultTheme],
  }),
  getters: {
    currentTheme(state) {
      return state.themes.find((theme) => theme.id === state.currentThemeId) || state.themes[0]
    },
  },
  actions: {
    initFromStorage() {
      if (typeof localStorage === 'undefined') return

      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) {
        this.persist()
        return
      }

      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed.themes) && parsed.themes.length) {
          this.themes = parsed.themes
        }
        if (typeof parsed.currentThemeId === 'string') {
          this.currentThemeId = parsed.currentThemeId
        }
      } catch (error) {
        console.warn('Failed to parse saved theme data. Reverting to default theme.', error)
        this.themes = [defaultTheme]
        this.currentThemeId = defaultTheme.id
      }

      this.persist()
    },
    setCurrentTheme(id) {
      const match = this.themes.find((theme) => theme.id === id)
      if (!match) return

      this.currentThemeId = id
      this.persist()
    },
    upsertTheme(theme) {
      if (!theme?.id) return

      const index = this.themes.findIndex((item) => item.id === theme.id)
      if (index !== -1) {
        this.themes.splice(index, 1, theme)
      } else {
        this.themes.push(theme)
      }

      this.persist()
    },
    persist() {
      if (typeof localStorage === 'undefined') return

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentThemeId: this.currentThemeId, themes: this.themes })
      )
    },
  },
})
