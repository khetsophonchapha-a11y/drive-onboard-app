// src/app/api/applications/route.ts
import { r2 } from '@/app/api/r2/_client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

// Helper to get a JSON object from R2
async function getJson(bucket: string, key: string): Promise<any | null> {
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await r2.send(command);
    const str = await response.Body?.transformToString();
    if (!str) return null;
    return JSON.parse(str);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

export async function GET(_req: NextRequest) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    console.error('R2_BUCKET environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const indexKey = 'applications/index.json';
    const applicationIndex = await getJson(bucket, indexKey);

    // If index.json doesn't exist, return an empty array, which is a valid state.
    return NextResponse.json(applicationIndex || []);
  } catch (error) {
    console.error('[Applications GET Error]', error);
    return NextResponse.json({ error: 'Failed to retrieve application list.' }, { status: 500 });
  }
}
