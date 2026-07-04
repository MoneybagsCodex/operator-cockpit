'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', background: '#0f172a', color: '#f1f5f9', minHeight: '100vh' }}>
      <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>Dashboard error</h2>
      <pre style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.85rem', color: '#fca5a5' }}>
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
      >
        Retry
      </button>
    </div>
  );
}
