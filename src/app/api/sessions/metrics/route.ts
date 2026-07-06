import { NextResponse } from 'next/server';
import http from 'http';

/**
 * Query the bridge server for session metrics.
 * The bridge runs on localhost:3002 and maintains session state.
 */
export async function GET() {
  try {
    return await new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:3002/metrics', (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const metrics = JSON.parse(data);
            resolve(NextResponse.json(metrics));
          } catch {
            resolve(NextResponse.json({ sessions: {} }, { status: 200 }));
          }
        });
      });
      req.on('error', () => {
        // Bridge not running or endpoint doesn't exist yet — return empty
        resolve(NextResponse.json({ sessions: {} }, { status: 200 }));
      });
    });
  } catch {
    return NextResponse.json({ sessions: {} }, { status: 200 });
  }
}
