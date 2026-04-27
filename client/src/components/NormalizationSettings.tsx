import React from 'react'
import { useStore } from '../store'
import { NormalizationEditor } from './NormalizationEditor'

export function NormalizationSettings() {
  const { request, setRequest } = useStore()
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Normalization</h3>
      <NormalizationEditor
        id="global"
        value={request.normalization}
        onChange={(normalization) => setRequest({ normalization })}
      />
    </div>
  )
}
