import { applications } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { AppRow, Manifest, VerificationStatus } from "@/lib/types";
import { desc, eq, isNull, isNotNull } from "drizzle-orm";
import { fetchAllUsers } from "@/lib/d1-users";
import { fetchAllHubs } from "@/lib/d1-hubs";

type ApplicationDbRow = typeof applications.$inferSelect;
type ApplicationSummaryRow = {
  appId: string;
  fullName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  phone?: string | null;
  verificationStatus?: string | null;
  rawData?: string | null;
};

export type ApplicationWithManifest = {
  row: ApplicationDbRow;
  manifest: Manifest;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type ApplicationContactSnapshot = {
  email: string;
  fullName?: string;
  phone?: string;
  currentAddressText?: string;
};

type ApplicationRowRecord = {
  id?: number | null;
  appId: string;
  fullName?: string | null;
  nationalId?: string | null;
  verificationStatus?: string | null;
  completenessStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  phone?: string | null;
  rawData?: string | null;
  deletedAt?: string | null;
};

async function getRawD1Binding() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env }: any = await getCloudflareContext();
    if (env?.DB?.prepare) {
      return env.DB;
    }
  } catch {
    // Ignore outside OpenNext/Cloudflare runtime
  }

  return null;
}

function normalizeApplicationRecord(row: any): ApplicationRowRecord {
  return {
    id: row.id ?? null,
    appId: row.appId ?? row.app_id ?? "",
    fullName: row.fullName ?? row.full_name ?? null,
    nationalId: row.nationalId ?? row.national_id ?? null,
    verificationStatus: row.verificationStatus ?? row.verification_status ?? row.status ?? null,
    completenessStatus: row.completenessStatus ?? row.completeness_status ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    phone: row.phone ?? null,
    rawData: row.rawData ?? row.raw_data ?? null,
    deletedAt: row.deletedAt ?? row.deleted_at ?? null,
  };
}

async function applicationsTableHasDeletedAt(): Promise<boolean> {
  const rawDb = await getRawD1Binding();
  if (!rawDb) {
    return true;
  }

  try {
    const res = await rawDb.prepare("PRAGMA table_info(applications)").all();
    const columns = res.results || [];
    return columns.some((column: any) => column.name === "deleted_at");
  } catch (error) {
    console.warn("[Applications] Failed to inspect applications schema", error);
    return true;
  }
}

export async function applicationsSupportSoftDelete(): Promise<boolean> {
  return applicationsTableHasDeletedAt();
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

function normalizeApplicationRow(row: any): ApplicationSummaryRow {
  return {
    appId: row.appId ?? row.app_id ?? "",
    fullName: row.fullName ?? row.full_name ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    phone: row.phone ?? null,
    verificationStatus: row.verificationStatus ?? row.verification_status ?? row.status ?? null,
    rawData: row.rawData ?? row.raw_data ?? null,
  };
}

export function buildApplicantCurrentAddressText(manifest: Manifest | null): string | undefined {
  const address = manifest?.applicant?.currentAddress;
  if (!address) return undefined;

  const parts = [
    address.houseNo ? `บ้านเลขที่ ${address.houseNo}` : "",
    address.moo ? `หมู่ ${address.moo}` : "",
    address.street ? `ถนน ${address.street}` : "",
    address.subDistrict ? `ตำบล/แขวง ${address.subDistrict}` : "",
    address.district ? `อำเภอ/เขต ${address.district}` : "",
    address.province ? `จังหวัด ${address.province}` : "",
    address.postalCode || "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

async function fetchApplicationRows() {
  let rows: ApplicationSummaryRow[] = [];
  const hasDeletedAt = await applicationsTableHasDeletedAt();

  const rawDb = await getRawD1Binding();
  if (rawDb) {
    try {
      const sql = hasDeletedAt
        ? "SELECT * FROM applications WHERE deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC"
        : "SELECT * FROM applications ORDER BY updated_at DESC, created_at DESC";
      const res = await rawDb.prepare(sql).all();
      rows = (res.results || []).map(normalizeApplicationRow);
    } catch (error) {
      console.warn("[Applications] Raw D1 query failed while fetching summaries", error);
    }
  }

  if (rows.length > 0) {
    return rows;
  }

  const db = await getDb();
  if (!db) return [];

  const rowsFromDrizzle = await db
    .select({
      appId: applications.appId,
      fullName: applications.fullName,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      phone: applications.phone,
      status: applications.verificationStatus,
      rawData: applications.rawData,
    })
    .from(applications)
    .where(hasDeletedAt ? isNull(applications.deletedAt) : undefined)
    .orderBy(desc(applications.updatedAt), desc(applications.createdAt))
    .all();

  return rowsFromDrizzle.map(normalizeApplicationRow);
}

export async function getLatestApplicationContactMap(): Promise<Map<string, ApplicationContactSnapshot>> {
  const rows = await fetchApplicationRows();
  const contactMap = new Map<string, ApplicationContactSnapshot>();

  for (const row of rows) {
    const manifest = parseManifest(row as ApplicationDbRow);
    const email = getManifestEmail(manifest);
    if (!email || contactMap.has(email)) continue;

    contactMap.set(email, {
      email,
      fullName: row.fullName || manifest?.applicant?.fullName || undefined,
      phone:
        row.phone ||
        manifest?.applicant?.mobilePhone ||
        manifest?.applicant?.homePhone ||
        undefined,
      currentAddressText: buildApplicantCurrentAddressText(manifest),
    });
  }

  return contactMap;
}

export async function getApplicationById(appId: string): Promise<ApplicationWithManifest | null> {
  const rawDb = await getRawD1Binding();
  if (rawDb) {
    try {
      const hasDeletedAt = await applicationsTableHasDeletedAt();
      const selectDeletedAt = hasDeletedAt ? ", deleted_at" : "";
      const res = await rawDb
        .prepare(
          `SELECT id, app_id, full_name, national_id, verification_status, completeness_status, created_at, updated_at, phone, raw_data${selectDeletedAt}
           FROM applications
           WHERE app_id = ?
           LIMIT 1`
        )
        .bind(appId)
        .all();
      const rawRow = res.results?.[0];
      if (rawRow) {
        const row = normalizeApplicationRecord(rawRow) as ApplicationDbRow;
        const manifest = parseManifest(row);
        if (!manifest) return null;
        return { row, manifest };
      }
    } catch (error) {
      console.warn(`[Applications] Raw D1 query failed for app ${appId}`, error);
    }
  }

  const db = await getDb();
  if (!db) return null;

  const row = await db
    .select({
      id: applications.id,
      appId: applications.appId,
      fullName: applications.fullName,
      nationalId: applications.nationalId,
      verificationStatus: applications.verificationStatus,
      completenessStatus: applications.completenessStatus,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      phone: applications.phone,
      rawData: applications.rawData,
    })
    .from(applications)
    .where(eq(applications.appId, appId))
    .get();
  if (!row) return null;

  const manifest = parseManifest(row as ApplicationDbRow);
  if (!manifest) return null;

  return { row: row as ApplicationDbRow, manifest };
}

export async function getApplicationStatusByEmail(email: string): Promise<VerificationStatus | null> {
  const rawDb = await getRawD1Binding();
  if (rawDb) {
    try {
      const res = await rawDb
        .prepare(
          `SELECT app_id, full_name, verification_status, created_at, updated_at, phone, raw_data
           FROM applications
           ORDER BY updated_at DESC, created_at DESC`
        )
        .all();
      const rows = (res.results || []).map((row: any) => normalizeApplicationRecord(row) as ApplicationDbRow);
      const normalizedEmail = normalizeEmail(email);

      for (const row of rows) {
        const manifest = parseManifest(row);
        if (getManifestEmail(manifest) !== normalizedEmail) continue;
        return (manifest?.status?.verification ?? row.verificationStatus ?? null) as VerificationStatus | null;
      }

      return null;
    } catch (error) {
      console.warn("[Applications] Raw D1 query failed while fetching status by email", error);
    }
  }

  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      id: applications.id,
      appId: applications.appId,
      fullName: applications.fullName,
      nationalId: applications.nationalId,
      verificationStatus: applications.verificationStatus,
      completenessStatus: applications.completenessStatus,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      phone: applications.phone,
      rawData: applications.rawData,
    })
    .from(applications)
    .orderBy(desc(applications.updatedAt), desc(applications.createdAt))
    .all();
  const normalizedEmail = normalizeEmail(email);

  for (const row of rows as ApplicationDbRow[]) {
    const manifest = parseManifest(row as ApplicationDbRow);
    if (getManifestEmail(manifest) !== normalizedEmail) continue;
    return (manifest?.status?.verification ?? row.verificationStatus ?? null) as VerificationStatus | null;
  }

  return null;
}

export async function findApplicationByEmail(
  email: string,
  options?: { excludeAppId?: string }
): Promise<ApplicationWithManifest | null> {
  const rawDb = await getRawD1Binding();
  if (rawDb) {
    try {
      const res = await rawDb
        .prepare(
          `SELECT id, app_id, full_name, national_id, verification_status, completeness_status, created_at, updated_at, phone, raw_data
           FROM applications
           ORDER BY updated_at DESC, created_at DESC`
        )
        .all();
      const rows = (res.results || []).map((row: any) => normalizeApplicationRecord(row) as ApplicationDbRow);
      const normalizedEmail = normalizeEmail(email);

      for (const row of rows) {
        if (options?.excludeAppId && row.appId === options.excludeAppId) continue;

        const manifest = parseManifest(row);
        if (getManifestEmail(manifest) !== normalizedEmail) continue;

        return { row, manifest: manifest as Manifest };
      }

      return null;
    } catch (error) {
      console.warn("[Applications] Raw D1 query failed while finding application by email", error);
    }
  }

  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select({
      id: applications.id,
      appId: applications.appId,
      fullName: applications.fullName,
      nationalId: applications.nationalId,
      verificationStatus: applications.verificationStatus,
      completenessStatus: applications.completenessStatus,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      phone: applications.phone,
      rawData: applications.rawData,
    })
    .from(applications)
    .orderBy(desc(applications.updatedAt), desc(applications.createdAt))
    .all();
  const normalizedEmail = normalizeEmail(email);

  for (const row of rows as ApplicationDbRow[]) {
    if (options?.excludeAppId && row.appId === options.excludeAppId) continue;

    const manifest = parseManifest(row as ApplicationDbRow);
    if (getManifestEmail(manifest) !== normalizedEmail) continue;

    return { row, manifest: manifest as Manifest };
  }

  return null;
}

export async function listApplicationSummaries(): Promise<AppRow[]> {
  try {
    const rows = await fetchApplicationRows();
    
    let allUsers: any[] = [];
    let allHubs: any[] = [];
    try {
      allUsers = await fetchAllUsers();
      allHubs = await fetchAllHubs();
    } catch (err) {
      console.error("[Applications] Failed to fetch users/hubs for summaries mapping", err);
    }
    const hubMap = new Map<string, string>(allHubs.map((h: any) => [h.id, h.name]));
    const userEmailMap = new Map<string, any>(allUsers.map((u: any) => [normalizeEmail(u.email), u]));

    return rows.map((row: any) => {
      let email: string | undefined;
      let terminatedAt: string | undefined;

      if (row.rawData) {
        try {
          const manifest = JSON.parse(row.rawData) as Manifest;
          email = manifest.applicant?.email ? normalizeEmail(manifest.applicant.email) : undefined;
          terminatedAt = manifest.status?.terminatedAt;
        } catch (error) {
          console.error("[Applications] Failed to parse summary manifest", row.appId, error);
        }
      }
      
      let hubId: string | null = null;
      let hubName: string | null = null;
      if (email) {
        const user = userEmailMap.get(email);
        if (user && user.hubId) {
          hubId = user.hubId;
          hubName = hubMap.get(hubId) || null;
        }
      }

      if (!terminatedAt && row.verificationStatus === 'terminated' && row.updatedAt) {
        terminatedAt = row.updatedAt;
      }

      return {
        appId: row.appId || "UNKNOWN",
        fullName: row.fullName || "Unknown",
        email,
        createdAt: row.createdAt || new Date().toISOString(),
        phone: row.phone || undefined,
        status: (row.verificationStatus || "pending") as VerificationStatus,
        hubId,
        hubName,
        terminatedAt,
      } satisfies AppRow;
    });
  } catch (error) {
    console.error("[Applications] Failed to fetch application summaries:", error);
    return [];
  }
}

export async function listDeletedApplicationSummaries(): Promise<(AppRow & { deletedAt: string })[]> {
  try {
    const hasDeletedAt = await applicationsTableHasDeletedAt();
    if (!hasDeletedAt) {
      console.warn("[Applications] deleted_at column is missing; deleted applications view is unavailable.");
      return [];
    }

    const rawDb = await getRawD1Binding();
    if (rawDb) {
      const res = await rawDb
        .prepare(
          `SELECT app_id, full_name, created_at, updated_at, phone, verification_status, raw_data, deleted_at
           FROM applications
           WHERE deleted_at IS NOT NULL
           ORDER BY updated_at DESC`
        )
        .all();
      const rows = (res.results || []).map(normalizeApplicationRecord);

      return rows.map((row: any) => {
        let email: string | undefined;
        let terminatedAt: string | undefined;
        if (row.rawData) {
          try {
            const manifest = JSON.parse(row.rawData) as Manifest;
            email = manifest.applicant?.email ? normalizeEmail(manifest.applicant.email) : undefined;
            terminatedAt = manifest.status?.terminatedAt;
          } catch {
            // Ignore malformed deleted rows
          }
        }
        if (!terminatedAt && row.verificationStatus === 'terminated' && row.updatedAt) {
          terminatedAt = row.updatedAt;
        }

        return {
          appId: row.appId || "UNKNOWN",
          fullName: row.fullName || "Unknown",
          email,
          createdAt: row.createdAt || new Date().toISOString(),
          phone: row.phone || undefined,
          status: (row.verificationStatus || "pending") as VerificationStatus,
          deletedAt: row.deletedAt!,
          terminatedAt,
        };
      });
    }

    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        appId: applications.appId,
        fullName: applications.fullName,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        phone: applications.phone,
        status: applications.verificationStatus,
        rawData: applications.rawData,
        deletedAt: applications.deletedAt,
      })
      .from(applications)
      .where(isNotNull(applications.deletedAt))
      .orderBy(desc(applications.updatedAt))
      .all();

    return rows.map((row: any) => {
      let email: string | undefined;
      let terminatedAt: string | undefined;
      if (row.rawData) {
        try {
          const manifest = JSON.parse(row.rawData) as Manifest;
          email = manifest.applicant?.email ? normalizeEmail(manifest.applicant.email) : undefined;
          terminatedAt = manifest.status?.terminatedAt;
        } catch { /* ignore */ }
      }
      if (!terminatedAt && row.status === 'terminated' && row.updatedAt) {
        terminatedAt = row.updatedAt;
      }

      return {
        appId: row.appId || "UNKNOWN",
        fullName: row.fullName || "Unknown",
        email,
        createdAt: row.createdAt || new Date().toISOString(),
        phone: row.phone || undefined,
        status: (row.status || "pending") as VerificationStatus,
        deletedAt: row.deletedAt!,
        terminatedAt,
      };
    });
  } catch (error) {
    console.error("[Applications] Failed to fetch deleted summaries:", error);
    return [];
  }
}
