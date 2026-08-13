import axios from 'axios'
import type { CompareRequest, CompareResult } from '@mintara/shared'

export async function runCompareRequest(req: CompareRequest): Promise<CompareResult> {
  const response = await axios.post<CompareResult>('/api/compare', req)
  return response.data
}
