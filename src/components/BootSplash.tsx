'use client';

import { useEffect, useState } from 'react';

/**
 * Full-screen boot splash shown on load: the logo monogram animates in with a
 * glow, the name fades up, then the whole splash fades out to reveal the
 * dashboard. Auto-unmounts (~2.3s). Colors follow the active scheme.
 */
export function BootSplash({ name = 'Operator Cockpit' }: { name?: string }) {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 1700);
    const t2 = setTimeout(() => setPhase('gone'), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${phase === 'out' ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'var(--scheme-bg, #0B0F19)' }}
    >
      <div
        className="w-[104px] h-[104px] rounded-3xl bg-blue-600 flex items-center justify-center text-white text-4xl font-bold"
        style={{ animation: 'bootLogoIn 720ms cubic-bezier(0.22,1,0.36,1) both, bootGlow 2s ease-in-out 720ms infinite' }}
      >
        OC
      </div>
      <div
        className="text-3xl font-bold tracking-tight text-slate-100"
        style={{ animation: 'bootNameIn 600ms ease-out 320ms both' }}
      >
        {name}
      </div>
      <div
        className="text-xs uppercase tracking-[0.25em] text-slate-500"
        style={{ animation: 'bootNameIn 600ms ease-out 520ms both' }}
      >
        Operator Cockpit
      </div>
    </div>
  );
}
