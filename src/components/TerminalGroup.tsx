'use client';

import { useState, ReactNode } from 'react';
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

  return (
    <div
      className={`min-h-0 rounded-lg flex flex-col overflow-hidden transition-shadow ${reorderDragOver ? 'ring-2 ring-blue-400' : ''}`}
      style={{ border: `4px solid ${color}`, gridRow: memberCount > 1 ? `span ${Math.min(memberCount, 3)}` : undefined }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setReorderDragOver(true); }}
      onDragLeave={() => setReorderDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setReorderDragOver(false); onReorderDrop(); }}
    >
      {/* Shared handle — the group's only drag source, and its merge target. */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border-b transition-colors cursor-grab active:cursor-grabbing ${mergeDragOver ? 'border-emerald-400 bg-slate-700' : 'border-slate-700'}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartGroup(); }}
        onDragEnd={onDragEndGroup}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setMergeDragOver(true); }}
        onDragLeave={() => setMergeDragOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setMergeDragOver(false); onMergeDrop(); }}
        title="Drag to move this group. Drop another terminal here to add it to the group."
      >
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
