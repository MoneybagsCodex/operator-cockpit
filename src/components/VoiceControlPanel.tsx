'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceStatus {
  isListening: boolean;
  transcript: string;
  lastCommand?: string;
  lastOutput?: string;
}

export function VoiceControlPanel() {
  const [status, setStatus] = useState<VoiceStatus>({
    isListening: false,
    transcript: '',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check voice service health on mount
  useEffect(() => {
    checkVoiceHealth();
    return () => {
      if (listeningIntervalRef.current) {
        clearInterval(listeningIntervalRef.current);
      }
    };
  }, []);

  const checkVoiceHealth = async () => {
    try {
      const response = await fetch('/api/voice/health');
      setIsConnected(response.ok);
    } catch {
      setIsConnected(false);
    }
  };

  const toggleListening = async () => {
    if (status.isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = async () => {
    setError(null);
    setStatus((prev) => ({ ...prev, isListening: true, transcript: '' }));

    // Poll for transcript updates
    listeningIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/voice/status');
        if (!response.ok) return;

        const data = await response.json();
        setStatus(data);

        if (!data.isListening) {
          // Listening stopped, clear interval
          if (listeningIntervalRef.current) {
            clearInterval(listeningIntervalRef.current);
          }
        }
      } catch (err) {
        console.error('Failed to fetch voice status:', err);
      }
    }, 500);
  };

  const stopListening = async () => {
    if (listeningIntervalRef.current) {
      clearInterval(listeningIntervalRef.current);
    }

    try {
      await fetch('/api/voice/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop listening:', err);
    }

    setStatus((prev) => ({ ...prev, isListening: false }));
  };

  const sendCommand = async (command: string) => {
    try {
      setError(null);
      const response = await fetch('/api/voice/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error('Failed to send command');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="voice-control-panel">
      <style>{`
        .voice-control-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
          min-width: 320px;
          max-width: 400px;
          z-index: 1000;
        }

        .voice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .voice-title {
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .voice-status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${!isConnected ? '#ef4444' : '#10b981'};
          animation: ${status.isListening ? 'pulse 1s infinite' : 'none'};
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .voice-status-text {
          font-size: 12px;
          color: ${isConnected ? '#d1fae5' : '#fee2e2'};
        }

        .voice-mic-button {
          background: ${status.isListening ? '#ef4444' : '#10b981'};
          border: none;
          color: white;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .voice-mic-button:hover {
          transform: scale(1.05);
        }

        .voice-mic-button:active {
          transform: scale(0.95);
        }

        .voice-transcript {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 12px;
          margin: 12px 0;
          font-size: 13px;
          min-height: 40px;
          max-height: 80px;
          overflow-y: auto;
          font-style: ${!status.transcript ? 'italic' : 'normal'};
          color: ${!status.transcript ? 'rgba(255,255,255,0.6)' : 'white'};
        }

        .voice-output {
          background: rgba(16, 185, 129, 0.1);
          border-left: 3px solid #10b981;
          border-radius: 4px;
          padding: 10px;
          margin: 8px 0;
          font-size: 12px;
          color: #d1fae5;
        }

        .voice-error {
          background: rgba(239, 68, 68, 0.1);
          border-left: 3px solid #ef4444;
          border-radius: 4px;
          padding: 10px;
          margin: 8px 0;
          font-size: 12px;
          color: #fee2e2;
        }

        .voice-footer {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
        }

        .voice-hint {
          flex: 1;
        }
      `}</style>

      <div className="voice-header">
        <div className="voice-title">
          <span className="voice-status-dot" />
          🎙️ Voice Control
        </div>
        <div className="voice-status-text">
          {!isConnected ? '❌ Offline' : status.isListening ? '🎤 Listening...' : '✓ Ready'}
        </div>
      </div>

      <button
        className="voice-mic-button"
        onClick={toggleListening}
        disabled={!isConnected}
        title={status.isListening ? 'Stop listening' : 'Start listening'}
      >
        {status.isListening ? '⏹' : '🎤'}
      </button>

      {status.transcript && (
        <div className="voice-transcript">
          <strong>Hearing:</strong> {status.transcript}
        </div>
      )}

      {status.lastCommand && (
        <div className="voice-output">
          <strong>Command:</strong> {status.lastCommand}
        </div>
      )}

      {status.lastOutput && (
        <div className="voice-output">
          <strong>Output:</strong> {status.lastOutput.substring(0, 100)}
          {status.lastOutput.length > 100 ? '...' : ''}
        </div>
      )}

      {error && <div className="voice-error">❌ {error}</div>}

      <div className="voice-footer">
        <div className="voice-hint">
          💡 Speak naturally: "run tests", "check logs", "add a task"
        </div>
      </div>
    </div>
  );
}
