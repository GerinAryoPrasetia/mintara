import axios from 'axios'
import type { FileFindRequest, FileFindResponse } from '@mintara/shared'

export async function findFiles(req: FileFindRequest): Promise<FileFindResponse> {
  const response = await axios.post<FileFindResponse>('/api/files/find', req)
  return response.data
}
