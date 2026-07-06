import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface SessionMetricsData {
  pid?: number;
  uptime?: number;
  uptimeSeconds?: number;
  lines?: number;
  chars?: number;
  tokens?: number;
  errors?: number;
}

interface SessionMetricsProps {
  sessionId: string;
}

export function SessionMetrics({ sessionId }: SessionMetricsProps) {
  const [metrics, setMetrics] = useState<SessionMetricsData | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/sessions/metrics');
        const data = await res.json() as { sessions: Record<string, SessionMetricsData> };
        setMetrics(data.sessions[sessionId] || null);
      } catch {
        setMetrics(null);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!metrics) return null;

  const formatTime = (ms: number): string => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    if (mins > 0) return `${mins}m ${secs % 60}s`;
    return `${secs}s`;
  };

  return (
    <div className="flex items-center gap-4 text-xs text-slate-400 bg-slate-700/30 rounded px-2 py-1 border border-slate-600/30">
      <Activity className="w-3 h-3 flex-shrink-0" />
      <div className="flex gap-4">
        <div title="Uptime">⏱ {formatTime(metrics.uptime || 0)}</div>
        <div title="Output lines">📄 {metrics.lines || 0}</div>
        <div title="Estimated tokens">🪙 {metrics.tokens || 0}</div>
        {(metrics.errors || 0) > 0 && (
          <div title="Error count" className="text-red-400">❌ {metrics.errors}</div>
        )}
        <div title="Process ID" className="text-slate-500">pid:{metrics.pid}</div>
      </div>
    </div>
  );
}
