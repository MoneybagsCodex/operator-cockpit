'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { RecoveryRequest } from '@/src/types';

// Phase 1 of the usage-limit resilience feature: detect + notify only.
// No launch action exists yet — dismissing a request just acknowledges it
// on disk (moves it out of pending/) so it stops showing here.
// Deliberately self-contained (own poll loop, like KnowledgeSyncPanel)
// rather than wired into the shared SSE live-state stream — this is a
// low-traffic, isolated signal and keeping it separate avoids adding risk
// to the core dashboard state pipeline while this is still Phase 1.
export function RecoveryBanner() {
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);

  const poll = useCallback(() => {
    fetch('/api/recovery?status=pending')
      .then((r) => r.json())
      .then((data: RecoveryRequest[]) => setRequests(data))
      .catch((err) => console.error('[RecoveryBanner] Failed to poll:', err));
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 20000);
    return () => clearInterval(iv);
  }, [poll]);

  const dismiss = async (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error('[RecoveryBanner] Failed to acknowledge:', err);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="w-full space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex items-start gap-2.5 px-4 py-3 bg-amber-950/40 border border-amber-800/60 rounded-lg"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-200">
              Claude hit a {r.reason || 'usage limit'}
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5 truncate" title={r.cwd}>
              {r.cwd || 'unknown project'}
            </p>
            <p className="text-[11px] text-amber-500/70 mt-1">
              Detected {new Date(r.detectedAt).toLocaleTimeString()} — no automatic action taken.
              Resume manually when your limit resets.
            </p>
          </div>
          <button
            onClick={() => dismiss(r.id)}
            className="text-amber-500/70 hover:text-amber-300 transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
