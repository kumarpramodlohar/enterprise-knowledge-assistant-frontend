export interface AppConfig {
  /** Base URL of the backend API without a trailing slash; empty means same origin (dev proxy). */
  apiBaseUrl: string
}

/**
 * Reads browser-safe configuration. Only non-secret values may use the VITE_ prefix because every
 * VITE_ value is embedded in the public bundle.
 */
export function parseConfig(env: { VITE_API_BASE_URL?: string }): AppConfig {
  const raw = (env.VITE_API_BASE_URL ?? '').trim()
  if (raw === '') return { apiBaseUrl: '' }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use http or https')
  }
  if (url.username || url.password) {
    throw new Error('VITE_API_BASE_URL must not contain credentials')
  }
  return { apiBaseUrl: raw.replace(/\/+$/, '') }
}

export const config = parseConfig(import.meta.env)
