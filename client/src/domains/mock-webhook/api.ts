import axios from 'axios'
import type { MockImportRequest, MockImportResult, MockResponse, MockRule, MockSlug, RecordedRequest } from '@mintara/shared'

export interface MockInfo {
  port: number
}

export async function getInfo(): Promise<MockInfo> {
  return (await axios.get<MockInfo>('/api/mocks/info')).data
}

export async function listMocks(): Promise<MockSlug[]> {
  return (await axios.get<MockSlug[]>('/api/mocks')).data
}

export async function createMock(slug: string): Promise<MockSlug> {
  return (await axios.post<MockSlug>('/api/mocks', { slug })).data
}

export async function importMocks(req: MockImportRequest): Promise<MockImportResult> {
  return (await axios.post<MockImportResult>('/api/mocks/import', req)).data
}

export async function updateMock(
  slug: string,
  patch: { rules: MockRule[]; defaultResponse: MockResponse },
): Promise<MockSlug> {
  return (await axios.put<MockSlug>(`/api/mocks/${encodeURIComponent(slug)}`, patch)).data
}

export async function renameMock(slug: string, newSlug: string): Promise<MockSlug> {
  return (await axios.post<MockSlug>(`/api/mocks/${encodeURIComponent(slug)}/rename`, { newSlug })).data
}

export async function deleteMock(slug: string): Promise<void> {
  await axios.delete(`/api/mocks/${encodeURIComponent(slug)}`)
}

export async function listRequests(slug: string, limit = 500): Promise<RecordedRequest[]> {
  return (await axios.get<RecordedRequest[]>(`/api/mocks/${encodeURIComponent(slug)}/requests`, { params: { limit } }))
    .data
}

export async function clearRequests(slug: string): Promise<void> {
  await axios.delete(`/api/mocks/${encodeURIComponent(slug)}/requests`)
}

export async function clearAllRequests(): Promise<void> {
  await axios.delete('/api/mocks/requests')
}

/** Live log via SSE. Returns a function that closes the stream. */
export function openStream(
  slug: string,
  onRequest: (r: RecordedRequest) => void,
  onCleared: () => void,
): () => void {
  const source = new EventSource(`/api/mocks/${encodeURIComponent(slug)}/stream`)
  source.addEventListener('request', (e) => onRequest(JSON.parse((e as MessageEvent<string>).data)))
  source.addEventListener('cleared', () => onCleared())
  return () => source.close()
}

/** Pulls the server's error message out of an axios failure. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined
    return data?.error ?? err.message
  }
  return err instanceof Error ? err.message : String(err)
}
