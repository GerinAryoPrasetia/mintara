import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, ListChecks, Columns } from 'lucide-react'

type AppPage = 'testcases' | 'diffchecker'

interface SidebarProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
}

const NAV_ITEMS: { page: AppPage; label: string; icon: typeof ListChecks }[] = [
  { page: 'testcases', label: 'API Diff Checker', icon: ListChecks },
  { page: 'diffchecker', label: 'Text Diff Checker', icon: Columns },
]

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 bg-white border-r border-slate-200 w-10 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-slate-100 mb-2"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`p-1.5 rounded mb-2 ${activePage === page ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-500'}`}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white border-r border-slate-200 w-56 shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 shrink-0">
        <span className="text-sm font-semibold text-slate-700">Menu</span>
        <button onClick={() => setCollapsed(true)} className="p-1.5 rounded hover:bg-slate-100" title="Collapse sidebar">
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col p-2 gap-1">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activePage === page
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
