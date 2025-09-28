// src/app/api/applications/route.ts
import { r2 } from '@/app/api/r2/_client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

// Helper to get a JSON object from R2 using a cached fetch
async function getJsonCached(bucket: string, key: string): Promise<any | null> {
  try {
    // 1. Get a signed URL for the object. This is a lightweight operation.
    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 } // URL is short-lived, just for this fetch
    );

    // 2. Use fetch() to get the object. Next.js automatically caches fetch requests.
    // We'll revalidate this data every hour.
    const response = await fetch(signedUrl, { next: { revalidate: 3600, tags: ['r2-index'] } });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch from R2 with status ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    // The AWS SDK throws a 'NoSuchKey' error name if the object doesn't exist.
    // Fetch doesn't do this, so we rely on the 404 check above.
    // We log other errors for debugging.
    console.error(`[R2 GetJsonCached Error] for key ${key}:`, error);
    // If it's a network or parsing error, we can't recover here.
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
    const applicationIndex = await getJsonCached(bucket, indexKey);

    // If index.json doesn't exist, return an empty array, which is a valid state.
    return NextResponse.json(applicationIndex || []);
  } catch (error) {
    console.error('[Applications GET Error]', error);
    return NextResponse.json({ error: 'Failed to retrieve application list.' }, { status: 500 });
  }
}
