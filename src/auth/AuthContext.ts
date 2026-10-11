import { createContext, useContext } from 'react'
import type { ApiClient } from '../api/client'
import type { Me } from '../api/types'

export type AuthState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; me: Me }
  | { status: 'expired' }

export interface AuthContextValue {
  state: AuthState
  /** Client whose requests carry the current credentials; the server decides what is allowed. */
  api: ApiClient
  /** Signs in with any Authorization header source (for example a bearer token from OIDC). */
  signInWithAuthHeader: (getHeader: () => string | null) => Promise<void>
  /** Local development profile only (the backend enables HTTP Basic only there). */
  signInWithBasic: (username: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
