import { applications } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { AppRow, Manifest, VerificationStatus } from "@/lib/types";
import { desc, eq } from "drizzle-orm";

type ApplicationDbRow = typeof applications.$inferSelect;

export type ApplicationWithManifest = {
  row: ApplicationDbRow;
  manifest: Manifest;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseManifest(row: ApplicationDbRow): Manifest | null {
  if (!row.rawData) return null;

  try {
    return JSON.parse(row.rawData) as Manifest;
  } catch (error) {
    console.error("[Applications] Failed to parse manifest", row.appId, error);
    return null;
  }
}

function getManifestEmail(manifest: Manifest | null) {
  const email = manifest?.applicant?.email;
  return typeof email === "string" ? normalizeEmail(email) : "";
}

export async function getApplicationById(appId: string): Promise<ApplicationWithManifest | null> {
  const db = await getDb();
  if (!db) return null;

  const row = await db.select().from(applications).where(eq(applications.appId, appId)).get();
  if (!row) return null;

  const manifest = parseManifest(row);
  if (!manifest) return null;

  return { row, manifest };
}

export async function getApplicationStatusByEmail(email: string): Promise<VerificationStatus | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(applications).orderBy(desc(applications.updatedAt), desc(applications.createdAt)).all();
  const normalizedEmail = normalizeEmail(email);

  for (const row of rows) {
    const manifest = parseManifest(row);
    if (getManifestEmail(manifest) !== normalizedEmail) continue;
    return (manifest?.status?.verification ?? row.verificationStatus ?? null) as VerificationStatus | null;
  }

  return null;
}

export async function findApplicationByEmail(
  email: string,
  options?: { excludeAppId?: string }
): Promise<ApplicationWithManifest | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(applications).orderBy(desc(applications.updatedAt), desc(applications.createdAt)).all();
  const normalizedEmail = normalizeEmail(email);

  for (const row of rows) {
    if (options?.excludeAppId && row.appId === options.excludeAppId) continue;

    const manifest = parseManifest(row);
    if (getManifestEmail(manifest) !== normalizedEmail) continue;

    return { row, manifest: manifest as Manifest };
  }

  return null;
}

export async function listApplicationSummaries(): Promise<AppRow[]> {
  try {
    let rows: any[] = [];
    
    // First, try to get the raw D1 binding directly to bypass Drizzle bugs
    try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const { env }: any = await getCloudflareContext();
        if (env && env.DB && env.DB.prepare) {
            console.log("Using raw D1 API for listApplicationSummaries");
            const res = await env.DB.prepare("SELECT * FROM applications ORDER BY createdAt DESC").all();
            rows = res.results || [];
        }
    } catch (e) {
        // Ignore OpenNext import error in local dev
    }

    // Fallback to Drizzle if raw D1 is not available (e.g. local dev or remote proxy)
    if (rows.length === 0) {
        const db = await getDb();
        if (!db) return [];

        rows = await db
            .select({
                appId: applications.appId,
                fullName: applications.fullName,
                createdAt: applications.createdAt,
                phone: applications.phone,
                status: applications.verificationStatus,
                rawData: applications.rawData,
            })
            .from(applications)
            .orderBy(desc(applications.createdAt))
            .all();
    }

    return rows.map((row: any) => {
      let email: string | undefined;
      let currentAddress: string | undefined;

      if (row.rawData) {
        try {
          const manifest = JSON.parse(row.rawData) as Manifest;
          email = manifest.applicant?.email ? normalizeEmail(manifest.applicant.email) : undefined;
          
          if (manifest.applicant?.currentAddress) {
            const addr = manifest.applicant.currentAddress;
            const parts = [
                addr.houseNo,
                addr.moo ? `ม.${addr.moo}` : null,
                addr.street ? `ถ.${addr.street}` : null,
                addr.subDistrict ? `ต.${addr.subDistrict}` : null,
                addr.district ? `อ.${addr.district}` : null,
                addr.province ? `จ.${addr.province}` : null,
                addr.postalCode
            ].filter(Boolean);
            currentAddress = parts.join(' ');
          }
        } catch (error) {
          console.error("[Applications] Failed to parse summary manifest", row.appId, error);
        }
      }

      return {
        appId: row.appId || "UNKNOWN",
        fullName: row.fullName || "Unknown",
        email,
        createdAt: row.createdAt || new Date().toISOString(),
        phone: row.phone || undefined,
        status: (row.status || row.verificationStatus || "pending") as VerificationStatus,
        currentAddress,
      } satisfies AppRow;
    });
  } catch (error) {
    console.error("[Applications] Failed to fetch application summaries:", error);
    return [];
  }
}
