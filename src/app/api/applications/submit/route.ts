
// src/app/api/applications/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { r2 } from '@/app/api/r2/_client';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Manifest, AppRow } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { isEqual } from 'lodash';

// We don't use the ManifestSchema directly because it has derived/read-only fields
const SubmitBodySchema = z.object({
  appId: z.string(),
  manifest: z.any(), // In a real app, you would validate the manifest with a more specific Zod schema
});


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

// Helper to put a JSON object to R2
async function putJson(bucket: string, key: string, data: any) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  });
  await r2.send(command);
}


export async function POST(req: NextRequest) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    console.error('R2_BUCKET environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { appId, manifest } = SubmitBodySchema.parse(body) as { appId: string; manifest: Manifest };
    
    // Ensure fullName is correctly assembled before saving
    manifest.applicant.fullName = `${manifest.applicant.firstName} ${manifest.applicant.lastName}`.trim();
    if(manifest.guarantor) {
      manifest.guarantor.fullName = `${manifest.guarantor.firstName || ''} ${manifest.guarantor.lastName || ''}`.trim() || undefined;
    }


    // Step 1: Write the full manifest.json for the application
    const manifestKey = `applications/${appId}/manifest.json`;
    await putJson(bucket, manifestKey, manifest);

    // Step 2: Conditionally upsert the index.json
    const indexKey = 'applications/index.json';
    const currentIndex: AppRow[] = (await getJson(bucket, indexKey)) || [];

    const newAppRow: AppRow = {
      appId: manifest.appId,
      fullName: manifest.applicant.fullName,
      createdAt: manifest.createdAt,
      phone: manifest.applicant.phone,
      status: manifest.status.verification,
    };

    const existingIndex = currentIndex.findIndex(row => row.appId === appId);
    let indexHasChanged = false;

    if (existingIndex !== -1) {
      // Entry exists, check if it has changed before replacing
      const existingRow = currentIndex[existingIndex];
      // Use lodash's isEqual for a deep, reliable comparison
      if (!isEqual(existingRow, newAppRow)) {
        currentIndex[existingIndex] = newAppRow;
        indexHasChanged = true;
      }
    } else {
      // New entry, always a change
      currentIndex.unshift(newAppRow); // Add to the top
      indexHasChanged = true;
    }
    
    // Only sort and write if there was a change
    if (indexHasChanged) {
        // Sort by creation date, newest first
        currentIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        await putJson(bucket, indexKey, currentIndex);
    }


    // Step 3: Revalidate caches
    // Revalidate the index only if it was actually changed.
    if (indexHasChanged) {
        revalidateTag('r2-index');
    }
    revalidateTag(`r2-app-${appId}`);

    return NextResponse.json({ ok: true, appId });

  } catch (error) {
    console.error('[Submit Error]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to submit application.' }, { status: 500 });
  }
}
