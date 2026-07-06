import { NextResponse } from 'next/server';
import { readEvents, readApprovals, readAgents, readProjects, readAllChat, writeApproval, decideApproval } from '@/src/lib/state';
import { startWatching } from '@/src/lib/watcher';
import { mockApprovals } from '@/src/data/mock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Track whether we've initialized test data
let testDataInitialized = false;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, data: unknown) => {
        const payload = `data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // client disconnected
        }
      };

      // Initialize test approvals on first client connection
      if (!testDataInitialized) {
        testDataInitialized = true;
        for (const approval of mockApprovals) {
          try {
            const existing = readApprovals('all').find((a) => a.id === approval.id);
            if (existing && existing.status !== 'pending') {
              // Reset stale test approval back to pending
              decideApproval(approval.id, 'pending');
              console.log(`[Stream] Reset test approval to pending: ${approval.id}`);
            } else if (!existing) {
              // Create new test approval
              writeApproval({ ...approval, status: 'pending', createdAt: approval.createdAt || new Date() });
              console.log(`[Stream] Initialized test approval: ${approval.id}`);
            }
          } catch (err) {
            console.error(`[Stream] Failed to initialize test approval:`, err);
          }
        }
      }

      // Send initial full state snapshot
      send('snapshot', {
        events: readEvents(),
        approvals: readApprovals('all'),
        agents: readAgents(),
        projects: readProjects(),
        chat: readAllChat(),
      });

      // Watch for changes and push diffs
      const stopWatching = startWatching((watchEvent) => {
        if (watchEvent.type === 'event') {
          send('events', readEvents());
        } else if (watchEvent.type === 'approval') {
          send('approvals', readApprovals('all'));
        } else if (watchEvent.type === 'agent') {
          send('agents', readAgents());
        } else if (watchEvent.type === 'project') {
          send('projects', readProjects());
        } else if (watchEvent.type === 'chat') {
          send('chat', readAllChat());
        }
      });

      // Heartbeat every 15s
      const heartbeat = setInterval(() => {
        send('heartbeat', { ts: Date.now() });
      }, 15000);

      // Cleanup when client disconnects
      return () => {
        clearInterval(heartbeat);
        stopWatching();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
