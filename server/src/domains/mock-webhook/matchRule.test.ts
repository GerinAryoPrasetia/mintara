import { describe, it, expect } from 'vitest'
import type { MockRule, MockSlug } from '@mintara/shared'
import { matchRule, normalizeSubPath } from './matchRule.js'

const res = { status: 200, headers: {}, body: '' }
const rule = (id: string, method: MockRule['method'], path: string): MockRule => ({ id, method, path, response: res })

const mock = (rules: MockRule[]): MockSlug => ({
  slug: 'voucher',
  rules,
  defaultResponse: res,
  createdAt: '',
  updatedAt: '',
})

describe('normalizeSubPath', () => {
  it('drops the query, adds a leading slash and trims a trailing one', () => {
    expect(normalizeSubPath('burn/?x=1')).toBe('/burn')
    expect(normalizeSubPath('')).toBe('/')
    expect(normalizeSubPath('/')).toBe('/')
  })
})

describe('matchRule', () => {
  it('returns unknown-slug when there is no mock', () => {
    expect(matchRule(undefined, 'GET', '/x')).toEqual({ kind: 'unknown-slug' })
  })

  it('matches on method (case-insensitive) and exact path', () => {
    const m = mock([rule('a', 'POST', '/burn')])
    expect(matchRule(m, 'post', '/burn')).toMatchObject({ kind: 'rule', rule: { id: 'a' } })
    expect(matchRule(m, 'GET', '/burn')).toEqual({ kind: 'default' })
    expect(matchRule(m, 'POST', '/burn/extra')).toEqual({ kind: 'default' })
  })

  it('treats ANY as matching every method', () => {
    const m = mock([rule('a', 'ANY', '/validate')])
    expect(matchRule(m, 'DELETE', '/validate')).toMatchObject({ kind: 'rule' })
  })

  it('supports * globs, including across slashes, and escapes other characters', () => {
    const m = mock([rule('a', 'GET', '/voucher/*'), rule('b', 'GET', '/v1.json')])
    expect(matchRule(m, 'GET', '/voucher/x/y')).toMatchObject({ rule: { id: 'a' } })
    expect(matchRule(m, 'GET', '/v1.json')).toMatchObject({ rule: { id: 'b' } })
    expect(matchRule(m, 'GET', '/v1xjson')).toEqual({ kind: 'default' })
  })

  it('first match wins', () => {
    const m = mock([rule('first', 'ANY', '/*'), rule('second', 'POST', '/burn')])
    expect(matchRule(m, 'POST', '/burn')).toMatchObject({ rule: { id: 'first' } })
  })

  it('ignores the query and a trailing slash on the incoming path', () => {
    const m = mock([rule('a', 'POST', '/burn')])
    expect(matchRule(m, 'POST', '/burn/?branch=1')).toMatchObject({ rule: { id: 'a' } })
  })

  it('falls back to the default when nothing matches', () => {
    expect(matchRule(mock([]), 'GET', '/anything')).toEqual({ kind: 'default' })
  })
})
