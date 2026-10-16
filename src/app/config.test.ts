import { describe, expect, it } from 'vitest'
import { parseConfig } from './config'

describe('parseConfig', () => {
  it('defaults to same-origin when unset', () => {
    expect(parseConfig({})).toEqual({ apiBaseUrl: '' })
  })
  it('strips trailing slashes', () => {
    expect(
      parseConfig({ VITE_API_BASE_URL: 'https://api.example.com//' }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.com',
    })
  })
  it.each(['not a url', 'ftp://host', 'https://user:pw@host'])(
    'rejects %s',
    (value) => {
      expect(() => parseConfig({ VITE_API_BASE_URL: value })).toThrow()
    },
  )

  it('enables OIDC only when authority and client id are both set', () => {
    expect(
      parseConfig({
        VITE_OIDC_AUTHORITY: 'http://127.0.0.1:8180/realms/eka/',
        VITE_OIDC_CLIENT_ID: 'eka-frontend',
      }).oidc,
    ).toEqual({ authority: 'http://127.0.0.1:8180/realms/eka', clientId: 'eka-frontend' })
    expect(parseConfig({}).oidc).toBeUndefined()
    expect(() => parseConfig({ VITE_OIDC_CLIENT_ID: 'eka-frontend' })).toThrow()
    expect(() =>
      parseConfig({ VITE_OIDC_AUTHORITY: 'ftp://x', VITE_OIDC_CLIENT_ID: 'c' }),
    ).toThrow()
  })
})
