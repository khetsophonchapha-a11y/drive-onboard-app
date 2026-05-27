// src/app/api/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { AppRow } from '@/lib/types';
import { auth } from '@/auth';
import { listApplicationSummaries, normalizeEmail } from '@/lib/applications';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mapped: AppRow[] = await listApplicationSummaries();
    const role = (user as { role?: string }).role;

    if (role === 'admin') {
      return NextResponse.json(mapped);
    }

    if (role === 'employee') {
      const userEmail = normalizeEmail(user.email ?? '');
      return NextResponse.json(
        mapped.filter((application) => normalizeEmail(application.email ?? '') === userEmail)
      );
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('[Applications GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
