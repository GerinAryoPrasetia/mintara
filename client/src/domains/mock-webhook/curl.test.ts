import { describe, it, expect } from 'vitest'
import { buildRawCurl } from './curl'

describe('buildRawCurl', () => {
  it('replays the raw body verbatim and skips hop-by-hop headers', () => {
    const curl = buildRawCurl(
      'post',
      'http://localhost:3001/hook/voucher/burn',
      { host: 'x', 'content-length': '9', 'content-type': 'text/plain' },
      'a=1&b=2',
    )
    expect(curl).toBe(
      "curl -X POST 'http://localhost:3001/hook/voucher/burn' \\\n  -H 'content-type: text/plain' \\\n  --data-raw 'a=1&b=2'",
    )
  })

  it("escapes single quotes and omits an empty body", () => {
    expect(buildRawCurl('GET', "http://h/it's", {}, '')).toBe("curl -X GET 'http://h/it'\\''s'")
    expect(buildRawCurl('DELETE', 'http://h', {}, '{"n":"O\'Neil"}')).toContain(`--data-raw '{"n":"O'\\''Neil"}'`)
  })

  it('emits one -H per value of a repeated header', () => {
    expect(buildRawCurl('GET', 'http://h', { 'x-a': ['1', '2'] }, '').match(/-H/g)).toHaveLength(2)
  })
})
