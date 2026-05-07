declare module 'vitepress' {
  export function defineConfig(config: unknown): unknown
}

declare module 'vitepress/theme' {
  const DefaultTheme: unknown
  export default DefaultTheme
}

declare module '*.css'
