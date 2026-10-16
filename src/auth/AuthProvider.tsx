import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import { AuthContext, type AuthState } from './AuthContext'
import type { OidcClient } from './oidcClient'

function basicHeader(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  return `Basic ${btoa(String.fromCharCode(...bytes))}`
}

/**
 * Keeps credentials in memory only (never web storage). The identity shown comes from the
 * server (`/me`); nothing here grants access, and a 401 from any call ends the session.
 */
export function AuthProvider({
  children,
  fetchImpl,
  baseUrl,
  oidc,
}: {
  children: ReactNode
  fetchImpl?: typeof fetch
  baseUrl?: string
  oidc?: OidcClient
}) {
  const header = useRef<(() => string | null) | null>(null)
  const [state, setState] = useState<AuthState>({ status: 'anonymous' })

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        fetchImpl,
        getAuthHeader: () => header.current?.() ?? null,
        onUnauthorized: () => {
          if (header.current) {
            header.current = null
            setState({ status: 'expired' })
          }
        },
      }),
    [baseUrl, fetchImpl],
  )

  const signInWithAuthHeader = useCallback(
    async (getHeader: () => string | null) => {
      header.current = getHeader
      try {
        const me = await api.me()
        setState({ status: 'authenticated', me })
      } catch (error) {
        header.current = null
        setState({ status: 'anonymous' })
        throw error
      }
    },
    [api],
  )

  const signInWithBasic = useCallback(
    (username: string, password: string) => {
      const value = basicHeader(username, password)
      return signInWithAuthHeader(() => value)
    },
    [signInWithAuthHeader],
  )

  const usingOidc = useRef(false)

  const signInWithOidc = useCallback(async () => {
    if (!oidc) throw new Error('OIDC is not configured')
    await oidc.startSignIn()
  }, [oidc])

  const completeOidcSignIn = useCallback(async () => {
    if (!oidc) throw new Error('OIDC is not configured')
    await oidc.completeSignIn()
    usingOidc.current = true
    await signInWithAuthHeader(() => oidc.authHeader())
  }, [oidc, signInWithAuthHeader])

  // A token that can no longer be renewed ends the session; the server stays authoritative.
  useEffect(
    () =>
      oidc?.onSessionEnded(() => {
        if (usingOidc.current) {
          header.current = null
          setState({ status: 'expired' })
        }
      }),
    [oidc],
  )

  const signOut = useCallback(() => {
    header.current = null
    setState({ status: 'anonymous' })
    if (usingOidc.current && oidc) {
      usingOidc.current = false
      void oidc.signOut()
    }
  }, [oidc])

  const value = useMemo(
    () => ({
      state,
      api,
      signInWithAuthHeader,
      signInWithBasic,
      oidcEnabled: oidc !== undefined,
      signInWithOidc,
      completeOidcSignIn,
      signOut,
    }),
    [state, api, signInWithAuthHeader, signInWithBasic, oidc, signInWithOidc, completeOidcSignIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
