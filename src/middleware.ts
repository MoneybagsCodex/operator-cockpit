import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  // Block cross-origin API requests (CSRF protection).
  // Browsers include Origin on cross-origin requests; absent = same-origin browser request.
  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('host') ?? '';
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Optional bearer token — set API_TOKEN in .env.local to enforce it.
  // Also accepts ?token= query param so EventSource (no custom headers) can authenticate.
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
  if (apiToken) {
    const authHeader = req.headers.get('authorization');
    const queryToken = req.nextUrl.searchParams.get('token');
    const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
    if (provided !== apiToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
