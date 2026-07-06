'use client';

import { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export function SyncDetailsPanel() {
  const [expanded, setExpanded] = useState(false);

  const dashboardPriorities = [
    { title: 'Apply to Management Consulting Firm', status: 'NOT STARTED', fit: '9.5/10' },
    { title: 'Submit EPIC Septic VBO application', status: 'DRAFT READY', fit: '9.5/10' },
    { title: 'Add ZD-Writer + ZAA Bot to portfolio', status: 'DRAFTED', fit: '—' },
    { title: 'Add CLAUDE_API_KEY to GitHub secrets', status: 'NOT STARTED', fit: '—' },
  ];

  const memoryNotes = [
    'Phase 12: mechanism-driven building (evidence + iteration over identity)',
    'Energy drains: swirl, ambiguity, open loops → prioritize clarity',
    'Strategic Coherence: identity + energy must align with DASHBOARD priorities',
  ];

  return (
    <div className="w-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Knowledge base sync</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-3 bg-slate-800/50">
          {/* Priorities Section */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
              Current Priorities
            </h4>
            <div className="space-y-1.5">
              {dashboardPriorities.slice(0, 3).map((p, i) => (
                <div key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-slate-500">•</span>
                  <span>
                    {p.title}{' '}
                    <span className="text-slate-500">({p.status})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Important Notes Section */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
              Key Reminders
            </h4>
            <div className="space-y-1.5">
              {memoryNotes.map((note, i) => (
                <div key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-amber-500">⚡</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Status */}
          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">
              Last synced: <span className="text-slate-400">Today at 11:10 AM</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
