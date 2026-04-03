// src/app/api/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { AppRow } from '@/lib/types';
import { sampleApplications } from '@/data/sample-data'; // Keep fallback just in case
import { listApplicationSummaries } from '@/lib/applications';

export async function GET(_req: NextRequest) {
  try {
    const mapped: AppRow[] = await listApplicationSummaries();
    return NextResponse.json(mapped);
  } catch (error) {
    console.error('[Applications GET Error]', error);
    // Fallback to sample data if DB fails (good for dev)
    return NextResponse.json(sampleApplications);
  }
}
