import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type User,
} from 'oidc-client-ts'
import type { OidcConfig } from '../app/config'

export const OIDC_CALLBACK_PATH = '/auth/callback'
export const OIDC_POST_LOGOUT_PATH = '/login'

export interface OidcClient {
  /** Redirects the browser to the identity provider. */
  startSignIn(): Promise<void>
  /** Completes the redirect callback; tokens are kept in memory only. */
  completeSignIn(): Promise<void>
  /** Current Authorization header value, or null when there is no valid token. */
  authHeader(): string | null
  /** Ends the provider session and returns to the login page. */
  signOut(): Promise<void>
  /** Calls the listener when the token can no longer be renewed. Returns an unsubscribe function. */
  onSessionEnded(listener: () => void): () => void
}

/**
 * Authorization Code flow with PKCE for a public client. Tokens live in memory only; the
 * transient redirect state (which holds no tokens) uses sessionStorage so it survives the redirect.
 */
export function createOidcClient(config: OidcConfig, origin = window.location.origin): OidcClient {
  let user: User | null = null
  const manager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: origin + OIDC_CALLBACK_PATH,
    post_logout_redirect_uri: origin + OIDC_POST_LOGOUT_PATH,
    response_type: 'code',
    scope: 'openid',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  })
  manager.events.addUserLoaded((loaded) => {
    user = loaded
  })

  return {
    startSignIn: () => manager.signinRedirect(),
    async completeSignIn() {
      user = await manager.signinRedirectCallback()
    },
    authHeader() {
      return user && !user.expired ? `Bearer ${user.access_token}` : null
    },
    async signOut() {
      const idToken = user?.id_token
      user = null
      await manager.removeUser()
      await manager.signoutRedirect({ id_token_hint: idToken })
    },
    onSessionEnded(listener) {
      const end = () => {
        user = null
        listener()
      }
      manager.events.addAccessTokenExpired(end)
      manager.events.addSilentRenewError(end)
      return () => {
        manager.events.removeAccessTokenExpired(end)
        manager.events.removeSilentRenewError(end)
      }
    },
  }
}
