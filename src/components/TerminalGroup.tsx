'use client';

import { useState, useEffect, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

interface TerminalGroupProps {
  /** Shared accent color for this group's border and label. */
  color: string;
  memberCount: number;
  /** Fires when the user starts dragging this group's handle (to reorder or merge it). */
  onDragStartGroup: () => void;
  onDragEndGroup: () => void;
  /** Dropped onto the group's handle → merge the dragged cell into this group. */
  onMergeDrop: () => void;
  /** Dropped onto the group's body → reorder (move the dragged cell to this position). */
  onReorderDrop: () => void;
  children: ReactNode;
}

// A group is ONE movable grid cell holding several TerminalPanels, sharing a
// single colored border and a single drag handle — dragging the handle moves
// (or merges) the whole group as one unit, not its individual members.
export function TerminalGroup({ color, memberCount, onDragStartGroup, onDragEndGroup, onMergeDrop, onReorderDrop, children }: TerminalGroupProps) {
  const [mergeDragOver, setMergeDragOver] = useState(false);
  const [reorderDragOver, setReorderDragOver] = useState(false);

  // Safety net: clear both highlights when any drag ends anywhere on the page,
  // so one can't get stuck on if a dragleave is ever missed (e.g. dropped off-window).
  useEffect(() => {
    const clear = () => { setMergeDragOver(false); setReorderDragOver(false); };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear); };
  }, []);

  return (
    <div
      className={`relative min-h-0 rounded-lg flex flex-col overflow-hidden transition-shadow ${reorderDragOver ? 'ring-4 ring-blue-400' : ''}`}
      style={{ border: `4px solid ${color}`, gridRow: memberCount > 1 ? `span ${Math.min(memberCount, 3)}` : undefined }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setReorderDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setReorderDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setReorderDragOver(false); onReorderDrop(); }}
    >
      {reorderDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-500/20 pointer-events-none">
          <span className="px-2.5 py-1 rounded bg-blue-500 text-white text-xs font-semibold shadow-lg">
            Move here
          </span>
        </div>
      )}
      {/* Shared handle — the group's only drag source, and its merge target. */}
      <div
        className={`relative flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border-b transition-colors cursor-grab active:cursor-grabbing ${mergeDragOver ? 'border-emerald-400 bg-slate-700' : 'border-slate-700'}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartGroup(); }}
        onDragEnd={onDragEndGroup}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setMergeDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMergeDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setMergeDragOver(false); onMergeDrop(); }}
        title="Drag to move this group. Drop another terminal here to add it to the group."
      >
        {mergeDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-emerald-500/20 pointer-events-none">
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-semibold shadow-lg whitespace-nowrap">
              Add to group
            </span>
          </div>
        )}
        <GripVertical className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <span className="text-[10px] uppercase tracking-wide font-semibold flex-shrink-0" style={{ color }}>
          Group · {memberCount}
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-1 p-1 bg-slate-950">
        {children}
      </div>
    </div>
  );
}
