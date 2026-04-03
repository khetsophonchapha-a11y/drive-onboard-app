// src/app/api/applications/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Manifest } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { applications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { findApplicationByEmail, normalizeEmail } from '@/lib/applications';

// We don't use the ManifestSchema directly because it has derived/read-only fields
const SubmitBodySchema = z.object({
  appId: z.string(),
  manifest: z.any(), // In a real app, you would validate the manifest with a more specific Zod schema
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, manifest } = SubmitBodySchema.parse(body) as { appId: string; manifest: Manifest };

    console.log(`[Submit API] Received submission for appId: ${appId}`);

    // Ensure fullName is correctly assembled before saving
    manifest.applicant.fullName = `${manifest.applicant.firstName} ${manifest.applicant.lastName}`.trim();
    if (manifest.guarantor) {
      manifest.guarantor.fullName = `${manifest.guarantor.firstName || ''} ${manifest.guarantor.lastName || ''}`.trim() || undefined;
    }

    const normalizedStatus = manifest.status ?? { completeness: 'incomplete', verification: 'pending' };
    normalizedStatus.completeness = normalizedStatus.completeness ?? 'incomplete';
    normalizedStatus.verification = normalizedStatus.verification ?? 'pending';
    manifest.status = normalizedStatus;

    // Get DB Connection
    const db = await getDb();
    if (!db) {
      console.error('[Submit API] Database connection failed: getDb() returned undefined.');
      return NextResponse.json({ error: 'Database connection unavailable.' }, { status: 503 });
    }

    // Check if exists using Drizzle
    let existingApp = null;
    try {
      existingApp = await db.select().from(applications).where(eq(applications.appId, appId)).get();
    } catch (dbError) {
      console.error('[Submit API] Error querying existing application:', dbError);
      // Continue to try insert if query failed (assuming it might be connection issue or truly new) - strict check better
      // But if query fails, insert likely fails too. Let's process.
    }

    console.log(`[Submit API] Existing app check result: ${existingApp ? 'Found' : 'Not Found'}`);

    const normalizedEmail = normalizeEmail(manifest.applicant.email);
    const duplicateApplication = await findApplicationByEmail(normalizedEmail, { excludeAppId: appId });
    if (duplicateApplication) {
      return NextResponse.json(
        {
          error: `อีเมล ${normalizedEmail} ถูกใช้สมัครไปแล้วในใบสมัคร ${duplicateApplication.row.appId}`,
        },
        { status: 409 }
      );
    }

    if (existingApp && existingApp.appId) {
      // Update existing using Drizzle
      console.log(`[Submit API] Updating application ${appId}...`);
      await db.update(applications)
        .set({
          fullName: manifest.applicant.fullName,
          verificationStatus: manifest.status.verification,
          completenessStatus: manifest.status.completeness,
          phone: manifest.applicant.mobilePhone || manifest.applicant.homePhone || "",
          rawData: JSON.stringify(manifest),
          updatedAt: new Date().toISOString()
        })
        .where(eq(applications.appId, appId));
    } else {
      // Insert new using Drizzle
      console.log(`[Submit API] Inserting new application ${appId}...`);
      const safeCreatedAt = manifest.createdAt ?? new Date().toISOString();
      const phone = manifest.applicant.mobilePhone || manifest.applicant.homePhone || "";

      await db.insert(applications).values({
        appId: appId,
        fullName: manifest.applicant.fullName,
        nationalId: manifest.applicant.nationalId,
        verificationStatus: manifest.status.verification,
        completenessStatus: manifest.status.completeness,
        createdAt: safeCreatedAt,
        updatedAt: safeCreatedAt,
        phone: phone,
        rawData: JSON.stringify(manifest)
      });
    }

    // --- Step 3: Revalidate caches ---
    console.log('[Submit API] Revalidating cache tags...');
    revalidateTag('r2-index');
    revalidateTag(`r2-app-${appId}`);

    console.log('[Submit API] Submission successful.');
    return NextResponse.json({ ok: true, appId });

  } catch (error) {
    console.error('[Submit API] Critical Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit application.', details: errorMessage }, { status: 500 });
  }
}
