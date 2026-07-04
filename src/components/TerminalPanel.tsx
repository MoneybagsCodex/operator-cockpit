'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, TerminalSquare, Pencil, Check, Maximize2, Minimize2 } from 'lucide-react';

interface TerminalPanelProps {
  title: string;
  /** ws://…/terminal?mode=launch&agent=… or ?mode=resume&session=… (cols/rows appended here) */
  wsUrl: string;
  /** Increment to send "accept" (selects Yes + Enter) — used by the "Trust all" button. */
  trustSignal?: number;
  /** Optional accent color linking this agent to its Jira ticket. */
  linkColor?: string;
  onRename?: (newName: string) => void;
  onClose: () => void;
}

export function TerminalPanel({ title, wsUrl, trustSignal, linkColor, onRename, onClose }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUser = useRef(false); // × pressed — suppress auto-reconnect + tell the bridge to end the agent
  const respTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outputBuf = useRef('');       // rolling recent terminal output (for prompt detection)
  const wantTrust = useRef(false);    // "Trust all" armed for this terminal
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [responding, setResponding] = useState(false); // green while output is streaming back
  const [ready, setReady] = useState(false); // false while the agent is booting/initializing
  const [needsAttention, setNeedsAttention] = useState(false); // true when the agent went idle waiting on the user
  const [maximized, setMaximized] = useState(false); // full-screen this one terminal
  const [reconnecting, setReconnecting] = useState(false); // true while retrying a dropped connection
  const [ended, setEnded] = useState(false); // the underlying claude session is gone (won't reconnect)
  const [stalled, setStalled] = useState(false); // repeated flaps — stopped retrying, panel kept
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // resets backoff once link is stable
  const readyRef = useRef(false);     // latest `ready` for use inside the WS closure
  const focusedRef = useRef(false);   // is the user currently in this terminal
  const attemptRef = useRef(0);       // reconnect attempt counter (drives backoff)
  const disposedRef = useRef(false);  // component unmounting — suppress reconnect
  useEffect(() => { readyRef.current = ready; }, [ready]);

  // Esc exits full-screen.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximized(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  // Mark the terminal "ready" once the claude input UI has rendered (past trust
  // + startup), so the "initializing" overlay can lift.
  const checkReady = () => {
    const rendered = containerRef.current?.querySelector('.xterm-rows')?.textContent || '';
    if (/for agents|accept edits|auto mode on|\? for shortcuts|bypass permissions/i.test(rendered)) {
      setReady(true);
    }
  };

  // Accept the claude startup trust prompt — but only when it's actually on
  // screen. Called on every output chunk and when "Trust all" is pressed, so it
  // fires exactly when the prompt appears regardless of WS/render timing.
  const acceptTrustIfPrompt = () => {
    const ws = wsRef.current;
    if (!wantTrust.current || !ws || ws.readyState !== WebSocket.OPEN) return;
    // Read the RENDERED terminal text (xterm strips ANSI for us) — far more
    // reliable than matching the raw PTY stream.
    const rendered = containerRef.current?.querySelector('.xterm-rows')?.textContent || '';
    if (!/trust this folder|Yes, I trust|one you trust|do you trust/i.test(rendered)) return;
    wantTrust.current = false; // accept once
    ws.send(JSON.stringify({ type: 'input', data: '1' }));
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: '\r' }));
    }, 120);
  };

  // Auto-accept the trust prompt on boot ("pre-trust") — arm on mount and poll
  // for up to ~15s while claude starts up and renders the prompt. The manual
  // "Trust all" button below re-triggers this for anything that didn't catch.
  useEffect(() => {
    wantTrust.current = true;
    acceptTrustIfPrompt();
    const iv = setInterval(() => { acceptTrustIfPrompt(); if (!wantTrust.current) clearInterval(iv); }, 500);
    const clear = setTimeout(() => { wantTrust.current = false; clearInterval(iv); }, 15000);
    return () => { clearInterval(iv); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety: never leave the "initializing" overlay stuck — lift it after 25s.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 25000);
    return () => clearTimeout(t);
  }, []);

  // "Trust all" → re-arm acceptance and retry for ~8s.
  useEffect(() => {
    if (!trustSignal) return;
    wantTrust.current = true;
    acceptTrustIfPrompt();
    const iv = setInterval(() => { acceptTrustIfPrompt(); if (!wantTrust.current) clearInterval(iv); }, 500);
    const clear = setTimeout(() => { wantTrust.current = false; clearInterval(iv); }, 8000);
    return () => { clearInterval(iv); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trustSignal]);

  // × = user intentionally ends this session: tell the bridge to kill the agent
  // now (don't leave it lingering through the grace window) and don't reconnect.
  const handleClose = () => {
    closedByUser.current = true;
    const ws = wsRef.current;
    try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'terminate' })); } catch { /* ignore */ }
    onClose();
  };

  const startRename = () => { setDraft(title); setEditing(true); };
  const saveRename = () => {
    const next = draft.trim();
    if (next && onRename) onRename(next);
    setEditing(false);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    disposedRef.current = false;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      theme: {
        background: '#0b1120',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#334155',
      },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termRef.current = term;

    // Fit once layout has settled
    const safeFit = () => { try { fit.fit(); } catch { /* not ready */ } };
    safeFit();

    const MAX_RECONNECT = 8; // after this many flaps, stop retrying (don't hot-loop)

    // (Re)open the socket for this panel's stable `sid`. On a *transient* drop we
    // retry with backoff; the bridge keeps the PTY alive (15m grace) so the same
    // sid re-attaches and replays scrollback — no lost context, no manual refresh.
    const scheduleReconnect = () => {
      if (disposedRef.current || closedByUser.current) return;
      const n = attemptRef.current++;
      if (n === 0) term.write('\r\n\x1b[90m[connection lost — reconnecting…]\x1b[0m\r\n');
      setReconnecting(true);
      const delay = Math.min(1000 * 2 ** n, 10000); // 1s,2s,4s,8s,10s…
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    // The session is truly over (claude exited / the conversation no longer exists).
    // Stop reconnecting and remove the panel so a dead id doesn't resurrect from
    // localStorage on the next refresh.
    const markEnded = () => {
      if (disposedRef.current) return;
      setReconnecting(false);
      setEnded(true);
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      term.write('\r\n\x1b[90m[session ended — closing this window]\x1b[0m\r\n');
      setTimeout(() => { if (!disposedRef.current) onClose(); }, 1600);
    };

    // Repeated flaps (e.g. a backgrounded tab suspending IO) — stop retrying but
    // KEEP the panel; a refresh reconnects. Prevents the hot-loop reconnect storm.
    const markStalled = () => {
      if (disposedRef.current) return;
      setReconnecting(false);
      setStalled(true);
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      term.write('\r\n\x1b[33m[disconnected — refresh the page to reconnect]\x1b[0m\r\n');
    };

    function connect() {
      if (disposedRef.current) return;
      const ws = new WebSocket(`${wsUrl}&cols=${term.cols}&rows=${term.rows}`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setReconnecting(false);
        setStalled(false);
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
        // Only declare the link healthy (reset the backoff counter) after it stays
        // open a few seconds — so a connection that opens-then-drops backs off
        // progressively instead of hot-looping.
        if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
        stableTimerRef.current = setTimeout(() => { attemptRef.current = 0; }, 4000);
        wantTrust.current = true; // re-arm trust acceptance for a resumed/fresh prompt
        term.focus();
      };
      ws.onmessage = (e) => {
        const chunk = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
        term.write(chunk);
        outputBuf.current = (outputBuf.current + chunk).slice(-6000);
        acceptTrustIfPrompt(); // fires when the trust prompt renders (if armed)
        checkReady();          // lifts the "initializing" overlay once the agent is up

        // Attention tracking: while output streams the agent is busy (clear the
        // flag). When it goes quiet for ~1.5s and the user isn't in this panel,
        // it's waiting on the user → light the tab in the palette accent color.
        setResponding(true);
        setNeedsAttention(false);
        if (respTimer.current) clearTimeout(respTimer.current);
        respTimer.current = setTimeout(() => {
          setResponding(false);
          if (readyRef.current && !focusedRef.current) setNeedsAttention(true);
        }, 1500);
      };
      // A close that isn't user-initiated: reconnect on a transient drop. If claude
      // actually exited / the conversation is gone → end (remove). If we just keep
      // flapping past the cap → stall (stop, keep panel). Otherwise reconnect.
      ws.onclose = () => {
        if (stableTimerRef.current) { clearTimeout(stableTimerRef.current); stableTimerRef.current = null; }
        if (disposedRef.current || closedByUser.current) return;
        const recent = outputBuf.current;
        const sessionGone = /session[\s\S]{0,60}not found|no conversation found|\[session ended/i.test(recent);
        if (sessionGone) { markEnded(); return; }
        if (attemptRef.current >= MAX_RECONNECT) { markStalled(); return; }
        scheduleReconnect();
      };
      ws.onerror = () => { /* onclose follows; reconnect handles recovery */ };
    }

    connect();

    // Keystrokes → PTY (and any input means the user is engaged → clear attention)
    const dataSub = term.onData((d) => {
      setNeedsAttention(false);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data: d }));
    });

    // Track whether the user is currently focused in this terminal.
    const ta = term.textarea;
    const onFocus = () => { focusedRef.current = true; setNeedsAttention(false); };
    const onBlur  = () => { focusedRef.current = false; };
    ta?.addEventListener('focus', onFocus);
    ta?.addEventListener('blur', onBlur);

    // Keep PTY size in sync with the panel
    const sendResize = () => {
      safeFit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };
    const ro = new ResizeObserver(() => sendResize());
    ro.observe(el);

    return () => {
      disposedRef.current = true; // suppress reconnect during teardown
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      if (stableTimerRef.current) { clearTimeout(stableTimerRef.current); stableTimerRef.current = null; }
      ro.disconnect();
      dataSub.dispose();
      ta?.removeEventListener('focus', onFocus);
      ta?.removeEventListener('blur', onBlur);
      if (respTimer.current) clearTimeout(respTimer.current);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      term.dispose();
    };
  }, [wsUrl]);

  return (
    <div
      className={`min-h-0 bg-[#0b1120] border border-slate-700 flex flex-col overflow-hidden ${
        maximized ? 'fixed inset-0 z-50 rounded-none' : 'rounded-lg'
      } ${needsAttention ? 'agent-attention' : ''}`}
      style={linkColor ? { boxShadow: `inset 4px 0 0 ${linkColor}` } : undefined}
    >
      {/* Header */}
      <div className="border-b border-slate-700 px-3 py-2 flex items-center justify-between gap-2 bg-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          {linkColor
            ? <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: linkColor }} title="Linked to a Jira ticket" />
            : <TerminalSquare className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="min-w-0 flex-1 bg-slate-700 text-slate-100 text-sm font-semibold px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          ) : (
            <span
              className={`text-sm font-semibold text-slate-100 truncate ${onRename ? 'cursor-text' : ''}`}
              onDoubleClick={onRename ? startRename : undefined}
              title={onRename ? 'Double-click to rename' : undefined}
            >
              {title}
            </span>
          )}
          {ended
            ? <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">ended</span>
            : stalled
            ? <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0" title="Refresh the page to reconnect">disconnected</span>
            : reconnecting
            ? <span className="text-[10px] uppercase tracking-wide text-amber-400 flex-shrink-0 animate-pulse">reconnecting…</span>
            : <span className="text-[10px] uppercase tracking-wide text-cyan-400/70 flex-shrink-0">live</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRename && !editing && (
            <button onClick={startRename} className="text-slate-500 hover:text-slate-300 transition-colors" title="Rename">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {editing && (
            <button onClick={saveRename} className="text-green-400 hover:text-green-300 transition-colors" title="Save name">
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Close terminal (ends the session)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal surface + initializing overlay */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 p-1 overflow-hidden" />
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0b1120]/92 backdrop-blur-[1px]">
            <div
              className="w-[52px] h-[52px] rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-bold"
              style={{ animation: 'bootGlow 1.8s ease-in-out infinite' }}
            >
              OC
            </div>
            <div className="text-xs text-slate-300 font-medium">
              Initializing agent<span className="loading-dots" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
