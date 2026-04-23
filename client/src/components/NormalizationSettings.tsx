import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '../components_ui/ui/input'
import { Badge } from '../components_ui/ui/badge'
import { useStore } from '../store'

export function NormalizationSettings() {
  const { request, setRequest } = useStore()
  const { normalization } = request
  const [fieldInput, setFieldInput] = useState('')

  const addIgnoreField = () => {
    const trimmed = fieldInput.trim()
    if (!trimmed || normalization.ignoreFields.includes(trimmed)) {
      setFieldInput('')
      return
    }
    setRequest({
      normalization: {
        ...normalization,
        ignoreFields: [...normalization.ignoreFields, trimmed],
      },
    })
    setFieldInput('')
  }

  const removeIgnoreField = (field: string) => {
    setRequest({
      normalization: {
        ...normalization,
        ignoreFields: normalization.ignoreFields.filter((f) => f !== field),
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addIgnoreField()
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Normalization</h3>

      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          Ignore Fields (dot-notation, press Enter to add)
        </label>
        <Input
          placeholder="e.g. user.updatedAt"
          value={fieldInput}
          onChange={(e) => setFieldInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addIgnoreField}
        />
        {normalization.ignoreFields.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {normalization.ignoreFields.map((f) => (
              <Badge key={f} variant="secondary" className="gap-1 cursor-pointer">
                {f}
                <X className="h-3 w-3" onClick={() => removeIgnoreField(f)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="sortArrays"
          checked={normalization.sortArrays}
          onChange={(e) =>
            setRequest({ normalization: { ...normalization, sortArrays: e.target.checked } })
          }
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="sortArrays" className="text-sm text-slate-700">
          Sort arrays before comparison
        </label>
      </div>
    </div>
  )
}
