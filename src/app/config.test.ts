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
})
