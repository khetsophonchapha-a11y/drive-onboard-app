'use server'

import { r2 } from '@/app/api/r2/_client';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Manifest, AppRow, VerificationStatus } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { isEqual } from 'lodash';

// Helper to get a JSON object from R2 (no cache)
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


export async function getImageAsDataUri(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUri = `data:${blob.type};base64,${buffer.toString('base64')}`;
        return dataUri;
    } catch (error) {
        console.error("Error converting image to data URI:", error);
        // In a real app, you might want to return a placeholder or handle this more gracefully
        return '';
    }
}


export async function updateApplicationStatus(appId: string, status: VerificationStatus): Promise<{ success: boolean; error?: string }> {
    const bucket = process.env.R2_BUCKET;
    if (!bucket) {
        const errorMsg = 'R2_BUCKET environment variable is not set.';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        // --- Step 1: Update the application manifest ---
        const manifestKey = `applications/${appId}/manifest.json`;
        const manifest: Manifest | null = await getJson(bucket, manifestKey);

        if (!manifest) {
            return { success: false, error: 'Application manifest not found.' };
        }

        // Only update if the status is different
        if (manifest.status.verification !== status) {
            manifest.status.verification = status;
            await putJson(bucket, manifestKey, manifest);
        }

        // --- Step 2: Update the application index ---
        const indexKey = 'applications/index.json';
        const currentIndex: AppRow[] = (await getJson(bucket, indexKey)) || [];
        const existingIndex = currentIndex.findIndex(row => row.appId === appId);

        let indexHasChanged = false;
        if (existingIndex !== -1) {
            // Update status if it's different
            if (currentIndex[existingIndex].status !== status) {
                currentIndex[existingIndex].status = status;
                indexHasChanged = true;
            }
        } else {
            // This shouldn't happen if the manifest exists, but as a fallback:
            const newAppRow: AppRow = {
                appId: manifest.appId,
                fullName: manifest.applicant.fullName,
                createdAt: manifest.createdAt,
                phone: manifest.applicant.phone,
                status: status,
            };
            currentIndex.unshift(newAppRow);
            indexHasChanged = true;
        }

        if (indexHasChanged) {
            // Sort by creation date, newest first
            currentIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            await putJson(bucket, indexKey, currentIndex);
        }

        // --- Step 3: Revalidate caches ---
        // We revalidate both tags to ensure all data is fresh across the app.
        revalidateTag(`r2-app-${appId}`);
        revalidateTag('r2-index');

        return { success: true };

    } catch (error: any) {
        console.error(`[Update Status Error for App ${appId}]`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
