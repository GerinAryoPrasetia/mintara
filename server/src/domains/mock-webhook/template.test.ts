import { describe, it, expect } from 'vitest'
import { renderTemplate, type TemplateContext } from './template.js'

const ctx: TemplateContext = {
  body: { voucherCodes: ['A1', 'B2'], amount: 5000, meta: { ok: true } },
  query: { branchCode: 'JKT01' },
  headers: { 'x-request-id': 'req-9' },
}

describe('renderTemplate', () => {
  it('fills body paths, array indexes, query and headers', () => {
    expect(renderTemplate('{"code":"{{body.voucherCodes.0}}","branch":"{{query.branchCode}}"}', ctx)).toBe(
      '{"code":"A1","branch":"JKT01"}',
    )
    expect(renderTemplate('{{ headers.X-Request-Id }}', ctx)).toBe('req-9')
  })

  it('JSON-stringifies non-string values', () => {
    expect(renderTemplate('{"amount":{{body.amount}},"meta":{{body.meta}}}', ctx)).toBe(
      '{"amount":5000,"meta":{"ok":true}}',
    )
  })

  it('renders unresolved paths as an empty string', () => {
    expect(renderTemplate('[{{body.missing.deep}}]', ctx)).toBe('[]')
    expect(renderTemplate('[{{nope}}]', { body: null, query: {}, headers: {} })).toBe('[]')
  })

  it('generates uuid, now and timestamp', () => {
    expect(renderTemplate('{{uuid}}', ctx)).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(renderTemplate('{{now}}', ctx)).toString()).not.toBe('Invalid Date')
    expect(Number(renderTemplate('{{timestamp}}', ctx))).toBeGreaterThan(0)
  })

  it('leaves text without placeholders untouched', () => {
    expect(renderTemplate('plain {text} here', ctx)).toBe('plain {text} here')
  })
})
