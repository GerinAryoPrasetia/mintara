import { create } from 'zustand'

interface FileDiffStore {
  diffOriginalText: string
  setDiffOriginalText: (text: string) => void
  diffModifiedText: string
  setDiffModifiedText: (text: string) => void
}

export const useFileDiffStore = create<FileDiffStore>()((set) => ({
  diffOriginalText: '',
  setDiffOriginalText: (text) => set({ diffOriginalText: text }),
  diffModifiedText: '',
  setDiffModifiedText: (text) => set({ diffModifiedText: text }),
}))
