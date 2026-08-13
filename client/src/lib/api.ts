import axios from 'axios'
import type { CompareRequest, CompareResult, FileFindRequest, FileFindResponse } from '@mintara/shared'

export async function runCompareRequest(req: CompareRequest): Promise<CompareResult> {
  const response = await axios.post<CompareResult>('/api/compare', req)
  return response.data
}

export async function findFiles(req: FileFindRequest): Promise<FileFindResponse> {
  const response = await axios.post<FileFindResponse>('/api/files/find', req)
  return response.data
}
