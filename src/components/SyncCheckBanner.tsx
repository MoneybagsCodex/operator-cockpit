'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface SyncCheckResult {
  timestamp: string;
  flags: string[];
  warnings: string[];
  errors: string[];
}

export function SyncCheckBanner() {
  const [result, setResult] = useState<SyncCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/sync-check')
      .then((r) => r.json())
      .then((data) => setResult(data))
      .catch(() => {});
  }, []);

  if (!result || dismissed) return null;

  const hasIssues = result.errors.length > 0 || result.warnings.length > 0 || result.flags.length > 0;

  if (!hasIssues) {
    return (
      <div className="bg-green-900/30 border border-green-700/50 text-green-300 text-xs px-3 py-2 rounded flex items-center gap-2 flex-shrink-0">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>Knowledge base in sync</span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-green-400 hover:text-green-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`border rounded px-3 py-2 flex gap-3 items-start flex-shrink-0 ${
      result.errors.length > 0
        ? 'bg-red-900/30 border-red-700/50 text-red-300'
        : result.warnings.length > 0
        ? 'bg-yellow-900/30 border-yellow-700/50 text-yellow-300'
        : 'bg-blue-900/30 border-blue-700/50 text-blue-300'
    }`}>
      <div className="flex gap-2 items-start min-w-0 flex-1">
        {result.errors.length > 0 ? (
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        ) : (
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        )}
        <div className="text-xs min-w-0">
          {result.errors.length > 0 && (
            <div className="mb-1">
              <strong>Sync errors:</strong>
              <ul className="list-disc list-inside">
                {result.errors.map((err, i) => (
                  <li key={i} className="truncate">{err}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="mb-1">
              <strong>Warnings:</strong>
              <ul className="list-disc list-inside">
                {result.warnings.map((warn, i) => (
                  <li key={i} className="truncate">{warn}</li>
                ))}
              </ul>
            </div>
          )}
          {result.flags.length > 0 && (
            <div>
              <strong>Flags:</strong>
              <ul className="list-disc list-inside">
                {result.flags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 opacity-60 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
