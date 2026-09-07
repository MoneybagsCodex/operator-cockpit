'use client';

import { useState, useEffect, ReactNode } from 'react';
import { GripVertical, Rows, Columns, Pencil, Check } from 'lucide-react';

type GroupDirection = 'vertical' | 'horizontal';

interface TerminalGroupProps {
  /** Shared accent color for this group's border and label. */
  color: string;
  memberCount: number;
  /** 'vertical' stacks members top-to-bottom (default), 'horizontal' side-by-side. */
  direction: GroupDirection;
  onToggleDirection: () => void;
  /** Custom group name; falls back to "Group · N" in the label when unset. */
  name?: string;
  onRename: (name: string) => void;
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
export function TerminalGroup({ color, memberCount, direction, onToggleDirection, name, onRename, onDragStartGroup, onDragEndGroup, onMergeDrop, onReorderDrop, children }: TerminalGroupProps) {
  const [mergeDragOver, setMergeDragOver] = useState(false);
  const [reorderDragOver, setReorderDragOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => { setDraft(name ?? ''); setEditing(true); };
  const saveRename = () => {
    const next = draft.trim();
    if (next) onRename(next);
    setEditing(false);
  };

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
      style={{
        border: `4px solid ${color}`,
        // Rotate the block's own footprint like a Tetris piece: vertical spans
        // extra grid ROWS (tall, narrow), horizontal spans extra grid COLUMNS
        // (short, wide) — the terminals inside just fill whatever shape results.
        // Column span capped at 2: the grid's narrowest breakpoint is 2 columns
        // (grid-cols-2), so spanning further would overflow it.
        gridRow: direction === 'vertical' && memberCount > 1 ? `span ${Math.min(memberCount, 3)}` : undefined,
        gridColumn: direction === 'horizontal' && memberCount > 1 ? `span ${Math.min(memberCount, 2)}` : undefined,
      }}
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
            placeholder={`Group · ${memberCount}`}
            className="min-w-0 flex-1 bg-slate-700 text-slate-100 text-[10px] font-semibold px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        ) : (
          <span
            className="min-w-0 flex-1 text-[10px] uppercase tracking-wide font-semibold truncate cursor-text"
            style={{ color }}
            onDoubleClick={startRename}
            title="Double-click to rename this group"
          >
            {name || `Group · ${memberCount}`}
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <button onClick={saveRename} className="text-green-400 hover:text-green-300 transition-colors" title="Save name">
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={startRename} className="text-slate-500 hover:text-slate-300 transition-colors" title="Rename group">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onToggleDirection}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title={direction === 'horizontal' ? 'Stack vertically' : 'Arrange side by side'}
          >
            {direction === 'horizontal' ? <Columns className="w-3.5 h-3.5" /> : <Rows className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div className={`flex-1 min-h-0 flex gap-1 p-1 bg-slate-950 ${direction === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
        {children}
      </div>
    </div>
  );
}
