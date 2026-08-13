import { describe, it, expect } from 'vitest'
import { buildCurl } from './curl'

describe('buildCurl', () => {
  it('emits GET with no body', () => {
    const result = buildCurl('GET', 'https://api.example.com/users', {}, undefined)
    expect(result).toBe("curl -X GET 'https://api.example.com/users'")
  })

  it('emits headers as -H flags', () => {
    const result = buildCurl('GET', 'https://api.example.com/users', {
      Authorization: 'Bearer token',
      'X-Custom': 'value',
    }, undefined)
    expect(result).toBe(
      "curl -X GET 'https://api.example.com/users' \\\n" +
      "  -H 'Authorization: Bearer token' \\\n" +
      "  -H 'X-Custom: value'"
    )
  })

  it('emits -d for POST with body', () => {
    const result = buildCurl('POST', 'https://api.example.com/users', {}, { name: 'Alice' })
    expect(result).toBe(
      "curl -X POST 'https://api.example.com/users' \\\n" +
      "  -d '{\"name\":\"Alice\"}'"
    )
  })

  it('emits -d for PUT with body', () => {
    const result = buildCurl('PUT', 'https://api.example.com/users/1', {}, { name: 'Bob' })
    expect(result).toBe(
      "curl -X PUT 'https://api.example.com/users/1' \\\n" +
      "  -d '{\"name\":\"Bob\"}'"
    )
  })

  it('does not emit -d for POST with undefined body', () => {
    const result = buildCurl('POST', 'https://api.example.com/users', {}, undefined)
    expect(result).toBe("curl -X POST 'https://api.example.com/users'")
  })

  it('does not emit -d for DELETE even with body', () => {
    const result = buildCurl('DELETE', 'https://api.example.com/users/1', {}, { id: 1 })
    expect(result).toBe("curl -X DELETE 'https://api.example.com/users/1'")
  })

  it('combines headers and body', () => {
    const result = buildCurl('POST', 'https://api.example.com/users', {
      'Content-Type': 'application/json',
    }, { name: 'Alice' })
    expect(result).toBe(
      "curl -X POST 'https://api.example.com/users' \\\n" +
      "  -H 'Content-Type: application/json' \\\n" +
      "  -d '{\"name\":\"Alice\"}'"
    )
  })
})
