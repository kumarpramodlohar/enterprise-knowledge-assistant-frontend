export interface OidcConfig {
  /** Issuer URL of the OIDC realm, for example http://127.0.0.1:8180/realms/eka. */
  authority: string
  /** Public client id; the browser client has no secret and uses Authorization Code with PKCE. */
  clientId: string
}

export interface AppConfig {
  /** Base URL of the backend API without a trailing slash; empty means same origin (dev proxy). */
  apiBaseUrl: string
  /** Present only when both OIDC settings are provided. */
  oidc?: OidcConfig
}

function parseHttpUrl(name: string, raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use http or https`)
  }
  if (url.username || url.password) {
    throw new Error(`${name} must not contain credentials`)
  }
  return raw.replace(/\/+$/, '')
}

/**
 * Reads browser-safe configuration. Only non-secret values may use the VITE_ prefix because every
 * VITE_ value is embedded in the public bundle.
 */
export function parseConfig(env: {
  VITE_API_BASE_URL?: string
  VITE_OIDC_AUTHORITY?: string
  VITE_OIDC_CLIENT_ID?: string
}): AppConfig {
  const rawApi = (env.VITE_API_BASE_URL ?? '').trim()
  const apiBaseUrl = rawApi === '' ? '' : parseHttpUrl('VITE_API_BASE_URL', rawApi)

  const rawAuthority = (env.VITE_OIDC_AUTHORITY ?? '').trim()
  const clientId = (env.VITE_OIDC_CLIENT_ID ?? '').trim()
  if (rawAuthority === '' && clientId === '') return { apiBaseUrl }
  if (rawAuthority === '' || clientId === '') {
    throw new Error('VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID must be set together')
  }
  return {
    apiBaseUrl,
    oidc: { authority: parseHttpUrl('VITE_OIDC_AUTHORITY', rawAuthority), clientId },
  }
}

export const config = parseConfig(import.meta.env)
