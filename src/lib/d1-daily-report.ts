import { isD1Enabled } from "./d1-client"; // Keep for legacy local check if needed
import { getDb } from "@/lib/db";
import { dailyReportSummary } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { TOTAL_DAILY_REPORT_SLOTS, type DailyReportProgressStatus } from "./daily-report";

// Type matching existing usage if needed (though we return explicit objects)
export type { DailyReportProgressStatus };

export function isD1DailyReportEnabled() {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.USE_REMOTE_D1 === "true") return true;
  if (
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_DATABASE_ID &&
    process.env.CLOUDFLARE_D1_TOKEN
  ) {
    return true;
  }
  return isD1Enabled();
}

function normalizeSummaryRow(row: any) {
  const uploadedCount =
    typeof row.uploadedCount === "number"
      ? row.uploadedCount
      : typeof row.uploaded_count === "number"
        ? row.uploaded_count
        : 0;

  const totalSlots =
    typeof row.totalSlots === "number"
      ? row.totalSlots
      : typeof row.total_slots === "number"
        ? row.total_slots
        : TOTAL_DAILY_REPORT_SLOTS;

  const extraUploadedCount =
    typeof row.extraUploadedCount === "number"
      ? row.extraUploadedCount
      : typeof row.extra_uploaded_count === "number"
        ? row.extra_uploaded_count
        : 0;

  return {
    appId: row.appId ?? row.app_id ?? row.email,
    fullName: row.fullName ?? row.full_name ?? row.email,
    email: row.email,
    phone: null,
    date: row.date,
    uploadedCount,
    extraUploadedCount,
    totalSlots,
    lastUpdated: row.lastUpdated ?? row.last_updated ?? undefined,
    status: row.status as DailyReportProgressStatus,
    notes: row.notes || undefined,
  };
}

export async function upsertDailyReportSummary(
  row: {
    email: string;
    date: string;
    fullName?: string;
    appId?: string;
    uploadedCount: number;
    extraUploadedCount?: number;
    totalSlots: number;
    lastUpdated?: string;
    status: DailyReportProgressStatus;
    notes?: string;
  }
) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(dailyReportSummary).values({
      email: row.email,
      date: row.date,
      fullName: row.fullName ?? row.email,
      appId: row.appId ?? row.email,
      uploadedCount: row.uploadedCount,
      extraUploadedCount: row.extraUploadedCount ?? 0,
      totalSlots: row.totalSlots,
      lastUpdated: row.lastUpdated ?? new Date().toISOString(),
      status: row.status,
      notes: row.notes,
    }).onConflictDoUpdate({
      target: [dailyReportSummary.email, dailyReportSummary.date],
      set: {
        fullName: row.fullName ?? row.email,
        appId: row.appId ?? row.email,
        uploadedCount: row.uploadedCount,
        extraUploadedCount: row.extraUploadedCount ?? 0,
        totalSlots: row.totalSlots,
        lastUpdated: row.lastUpdated ?? new Date().toISOString(),
        status: row.status,
        notes: row.notes,
      },
    });
  } catch (error) {
    console.error("[D1] upsertDailyReportSummary error:", error);
  }
}

export async function deleteDailyReportSummary(email: string, date: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(dailyReportSummary).where(
      and(eq(dailyReportSummary.email, email), eq(dailyReportSummary.date, date))
    );
  } catch (error) {
    console.error("[D1] deleteDailyReportSummary error:", error);
  }
}

export async function fetchDailyReportSummaryRange(
  startDate: string,
  endDate: string,
  email?: string
) {
  try {
    // Try raw D1 binding first (bypasses Drizzle issues on Pages)
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env }: any = await getCloudflareContext();
      if (env && env.DB && env.DB.prepare) {
        console.log("Using raw D1 API for fetchDailyReportSummaryRange");
        let stmt;
        if (email) {
          stmt = env.DB.prepare(
            "SELECT * FROM daily_report_summary WHERE date >= ? AND date <= ? AND email = ? ORDER BY date ASC"
          ).bind(startDate, endDate, email);
        } else {
          stmt = env.DB.prepare(
            "SELECT * FROM daily_report_summary WHERE date >= ? AND date <= ? ORDER BY date ASC"
          ).bind(startDate, endDate);
        }
        const res = await stmt.all();
        const rows = res.results || [];
        return rows.map((row: any) => normalizeSummaryRow(row));
      }
    } catch (e) {
      // Ignored in local dev
    }

    // Fallback to Drizzle
    const db = await getDb();
    if (!db) return null;

    const conditions = [
      gte(dailyReportSummary.date, startDate),
      lte(dailyReportSummary.date, endDate)
    ];

    if (email) {
      conditions.push(eq(dailyReportSummary.email, email));
    }

    const rows = await db.select().from(dailyReportSummary).where(and(...conditions));

    return rows.map((row: any) => normalizeSummaryRow(row));
  } catch (error) {
    console.error("[D1] fetchDailyReportSummaryRange error:", error);
    return null;
  }
}
