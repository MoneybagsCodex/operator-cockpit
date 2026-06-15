import { NextResponse } from 'next/server';
import { readEvents, readApprovals, readAgents, readProjects, readAllChat } from '@/src/lib/state';
import { startWatching } from '@/src/lib/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
