import type { MockResponse } from '@mintara/shared'

export const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' }

export function defaultMockResponse(): MockResponse {
  return { status: 200, headers: { ...JSON_HEADERS }, body: '{"status":"success"}' }
}
