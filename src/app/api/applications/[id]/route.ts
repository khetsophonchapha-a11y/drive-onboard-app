// src/app/api/applications/[id]/route.ts
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const appId = params.id;
  if (!appId) {
    return NextResponse.json({ error: 'Application ID is required' }, { status: 400 });
  }

  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    console.error('R2_BUCKET environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const manifestKey = `applications/${appId}/manifest.json`;
    const manifest = await getJson(bucket, manifestKey);

    if (!manifest) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json(manifest);
  } catch (error) {
    console.error(`[App ${appId} GET Error]`, error);
    return NextResponse.json({ error: 'Failed to retrieve application data.' }, { status: 500 });
  }
}
