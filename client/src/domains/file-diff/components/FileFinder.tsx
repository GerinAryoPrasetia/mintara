import React, { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, FileX } from 'lucide-react'
import { Button } from '../../../components_ui/ui/button'
import { Input } from '../../../components_ui/ui/input'
import { useFileDiffStore } from '../store'
import { findFiles } from '../api'
import { groupMatchesByPath } from '../matching'
import type { FileFindResponse, FileFindEntry, FileMatch } from '@mintara/shared'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileFinder() {
  const { setDiffOriginalText, setDiffModifiedText } = useFileDiffStore()
  const [collapsed, setCollapsed] = useState(false)

  const [originalRoot, setOriginalRoot] = useState('')
  const [modifiedRoot, setModifiedRoot] = useState('')
  const [filenamesText, setFilenamesText] = useState('')

  const [result, setResult] = useState<FileFindResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const filenames = filenamesText.split('\n').map((f) => f.trim()).filter(Boolean)
  const canSearch = originalRoot.trim() !== '' && modifiedRoot.trim() !== '' && filenames.length > 0

  const handleFind = async () => {
    if (!canSearch || isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await findFiles({
        originalRoot: originalRoot.trim(),
        modifiedRoot: modifiedRoot.trim(),
        filenames,
      })
      setResult(res)
      setExpanded(new Set(res.entries.map((e) => e.filename)))
      setCurrentIndex(null)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Unknown error')
      setError(message)
      setResult(null)
      setCurrentIndex(null)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpanded = (filename: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  // Loads the best-available content for an entry: a matched pair if one
  // exists, otherwise whatever single-sided match is available.
  const loadEntryBest = (entry: FileFindEntry) => {
    const { paired } = groupMatchesByPath(entry.originalMatches, entry.modifiedMatches)
    if (paired.length > 0) {
      setDiffOriginalText(paired[0].original.content)
      setDiffModifiedText(paired[0].modified.content)
    } else {
      if (entry.originalMatches.length > 0) setDiffOriginalText(entry.originalMatches[0].content)
      if (entry.modifiedMatches.length > 0) setDiffModifiedText(entry.modifiedMatches[0].content)
    }
  }

  const goToIndex = (index: number) => {
    const entry = result?.entries[index]
    if (!entry) return
    setCurrentIndex(index)
    setExpanded((prev) => new Set(prev).add(entry.filename))
    loadEntryBest(entry)
    entryRefs.current[entry.filename]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const goPrev = () => {
    if (!result) return
    const target = (currentIndex ?? 0) - 1
    if (target >= 0) goToIndex(target)
  }

  const goNext = () => {
    if (!result) return
    const target = (currentIndex ?? -1) + 1
    if (target < result.entries.length) goToIndex(target)
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 bg-white border-l border-slate-200 w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-slate-100"
          title="Expand file finder"
        >
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white border-l border-slate-200 w-80 shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 shrink-0">
        <span className="text-sm font-semibold text-slate-700">File Finder</span>
        <button onClick={() => setCollapsed(true)} className="p-1.5 rounded hover:bg-slate-100" title="Collapse file finder">
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Inputs */}
      <div className="px-3 py-3 space-y-2 border-b border-slate-100 shrink-0">
        <div>
          <label htmlFor="original-root" className="block text-xs font-medium text-slate-500 mb-1">
            Original root path
          </label>
          <Input
            id="original-root"
            title={originalRoot || 'Original root path'}
            value={originalRoot}
            onChange={(e) => setOriginalRoot(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label htmlFor="modified-root" className="block text-xs font-medium text-slate-500 mb-1">
            Modified root path
          </label>
          <Input
            id="modified-root"
            title={modifiedRoot || 'Modified root path'}
            value={modifiedRoot}
            onChange={(e) => setModifiedRoot(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label htmlFor="finder-filenames" className="block text-xs font-medium text-slate-500 mb-1">
            Filenames (one per line)
          </label>
          <textarea
            id="finder-filenames"
            value={filenamesText}
            onChange={(e) => setFilenamesText(e.target.value)}
            className="w-full h-20 p-2 text-xs font-mono border border-slate-200 rounded resize-none focus:ring-0 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <Button size="sm" className="w-full h-7 text-xs" onClick={handleFind} disabled={!canSearch || isLoading}>
          <Search className="h-3.5 w-3.5 mr-1" /> {isLoading ? 'Searching…' : 'Find'}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {result?.warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-600">{w.message}</p>
        ))}
      </div>

      {/* Prev / Next navigation */}
      {result && result.entries.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={goPrev} disabled={currentIndex === null || currentIndex <= 0}>
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
          </Button>
          <span className="text-xs text-slate-500">
            {currentIndex !== null ? `${currentIndex + 1} / ${result.entries.length}` : `${result.entries.length} file${result.entries.length !== 1 ? 's' : ''}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={goNext}
            disabled={currentIndex !== null && currentIndex >= result.entries.length - 1}
          >
            Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!result ? (
          <p className="text-xs text-slate-400 text-center py-6">Run a search to see results.</p>
        ) : (
          result.entries.map((entry, index) => (
            <div key={entry.filename} ref={(el) => { entryRefs.current[entry.filename] = el }}>
              <FileFinderEntryBlock
                entry={entry}
                isExpanded={expanded.has(entry.filename)}
                isActive={index === currentIndex}
                onToggle={() => toggleExpanded(entry.filename)}
                onLoadOriginal={(m) => {
                  setDiffOriginalText(m.content)
                  setCurrentIndex(index)
                }}
                onLoadModified={(m) => {
                  setDiffModifiedText(m.content)
                  setCurrentIndex(index)
                }}
                onLoadBoth={(orig, mod) => {
                  setDiffOriginalText(orig.content)
                  setDiffModifiedText(mod.content)
                  setCurrentIndex(index)
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function FileFinderEntryBlock({
  entry,
  isExpanded,
  isActive,
  onToggle,
  onLoadOriginal,
  onLoadModified,
  onLoadBoth,
}: {
  entry: FileFindEntry
  isExpanded: boolean
  isActive: boolean
  onToggle: () => void
  onLoadOriginal: (match: FileMatch) => void
  onLoadModified: (match: FileMatch) => void
  onLoadBoth: (original: FileMatch, modified: FileMatch) => void
}) {
  const totalMatches = entry.originalMatches.length + entry.modifiedMatches.length
  const notFound = totalMatches === 0
  const { paired, originalOnly, modifiedOnly } = groupMatchesByPath(entry.originalMatches, entry.modifiedMatches)

  return (
    <div className="border-b border-slate-100">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
          isActive ? 'bg-slate-800' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {notFound && <FileX className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-red-300' : 'text-red-400'}`} />}
          <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{entry.filename}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-xs ${
              notFound ? (isActive ? 'text-red-300' : 'text-red-500') : isActive ? 'text-slate-300' : 'text-slate-400'
            }`}
          >
            {notFound ? 'not found' : `${entry.originalMatches.length} orig / ${entry.modifiedMatches.length} mod`}
          </span>
          {isExpanded ? (
            <ChevronUp className={`h-3.5 w-3.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`} />
          ) : (
            <ChevronDown className={`h-3.5 w-3.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {paired.length > 0 && (
            <div className="space-y-1.5">
              {paired.map(({ path, original, modified }) => (
                <FileFinderPairRow
                  key={path}
                  path={path}
                  original={original}
                  modified={modified}
                  onLoad={() => onLoadBoth(original, modified)}
                />
              ))}
            </div>
          )}
          {originalOnly.length > 0 && (
            <FileFinderMatchList
              label="Original-only matches"
              matches={originalOnly}
              loadLabel="Load → Original"
              onLoad={onLoadOriginal}
            />
          )}
          {modifiedOnly.length > 0 && (
            <FileFinderMatchList
              label="Modified-only matches"
              matches={modifiedOnly}
              loadLabel="Load → Modified"
              onLoad={onLoadModified}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FileFinderPairRow({
  path,
  original,
  modified,
  onLoad,
}: {
  path: string
  original: FileMatch
  modified: FileMatch
  onLoad: () => void
}) {
  return (
    <div className="rounded border border-slate-200 p-1.5 space-y-1.5">
      <p className="text-xs font-mono text-slate-700 break-all" title={path}>
        {path}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Orig {formatSize(original.sizeBytes)}
          {original.truncated ? ' · truncated' : ''}
        </span>
        <span>
          Mod {formatSize(modified.sizeBytes)}
          {modified.truncated ? ' · truncated' : ''}
        </span>
      </div>
      <Button size="sm" className="w-full h-7 text-xs" onClick={onLoad}>
        Load Both
      </Button>
    </div>
  )
}

function FileFinderMatchList({
  label,
  matches,
  loadLabel,
  onLoad,
}: {
  label: string
  matches: FileMatch[]
  loadLabel: string
  onLoad: (match: FileMatch) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {matches.length === 0 ? (
        <p className="text-xs text-slate-400">No match</p>
      ) : (
        <div className="space-y-1.5">
          {matches.map((m, i) => (
            <div key={i} className="rounded border border-slate-200 p-1.5">
              <p className="text-xs font-mono text-slate-700 break-all" title={m.relativePath}>
                {m.relativePath}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-400">
                  {formatSize(m.sizeBytes)}
                  {m.truncated ? ' · truncated' : ''}
                </span>
                <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs" onClick={() => onLoad(m)}>
                  {loadLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
