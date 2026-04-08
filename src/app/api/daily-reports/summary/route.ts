import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getR2Binding } from "@/lib/r2/binding";
import {
  DailyReportDateSchema,
  DailyReportEmailSchema,
  countUploadedSlots,
  normalizeDailyReportRecord,
  TOTAL_DAILY_REPORT_SLOTS,
  getDailyReportProgressStatus,
  sanitizeEmailForPath,
} from "@/lib/daily-report";
import { sampleAccounts, sampleApplications, getSampleDailyReport } from "@/data/sample-data";
import { parseISO, eachDayOfInterval, startOfMonth, endOfMonth, format } from "date-fns";
import { fetchDailyReportSummaryRange, isD1DailyReportEnabled } from "@/lib/d1-daily-report";
import { fetchAllUsers, isD1UsersEnabled } from "@/lib/d1-users";

async function getJson(bucket: any, key: string): Promise<any | null> {
  try {
    const object = await bucket.get(key);
    if (!object) return null;
    return await object.json();
  } catch (error: any) {
    if (error.name === "NoSuchKey") {
      return null;
    }
    console.error(`Failed to get JSON for ${key}`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user as { role?: string }).role;
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedEmail = searchParams.get("email") || undefined;
  const email = role === "employee" ? user.email || undefined : requestedEmail;
  const month = searchParams.get("month") || undefined;
  const date = searchParams.get("date") || undefined;
  const startParam = searchParams.get("startDate") || undefined;
  const endParam = searchParams.get("endDate") || undefined;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const monthRegex = /^\d{4}-\d{2}$/;

  const startStr =
    (startParam && dateRegex.test(startParam) ? startParam : undefined) ||
    (date && dateRegex.test(date) ? date : undefined) ||
    (month && monthRegex.test(month) ? `${month}-01` : undefined) ||
    format(new Date(), "yyyy-MM-dd");

  const endStr =
    (endParam && dateRegex.test(endParam) ? endParam : undefined) ||
    (date && dateRegex.test(date) ? date : undefined) ||
    (month && monthRegex.test(month)
      ? format(endOfMonth(parseISO(`${month}-01`)), "yyyy-MM-dd")
      : undefined) ||
    startStr;

  const startDate = parseISO(startStr);
  const endDate = parseISO(endStr);
  const today = new Date();
  const clampedEnd = endDate > today ? today : endDate;
  const clampedStart = startDate > clampedEnd ? clampedEnd : startDate;

  const clampedStartStr = format(clampedStart, "yyyy-MM-dd");
  const clampedEndStr = format(clampedEnd, "yyyy-MM-dd");

  const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd });

  // Prefer D1 index if available
  if (isD1DailyReportEnabled()) {
    const d1Rows = await fetchDailyReportSummaryRange(clampedStartStr, clampedEndStr, email);
    if (d1Rows) {
      const fillMissingForEmail = (targetEmail: string, sourceRows: any[]): any[] => {
        const byDate = new Map(sourceRows.map((r) => [r.date, r]));
        return days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const existing = byDate.get(dateStr);
          if (existing) return existing;
          return {
            appId: targetEmail,
            fullName: targetEmail,
            email: targetEmail,
            phone: null,
            date: dateStr,
            uploadedCount: 0,
            totalSlots: TOTAL_DAILY_REPORT_SLOTS,
            status: "missing",
            lastUpdated: undefined,
            notes: undefined,
          };
        });
      };

      if (email) {
        const filled = fillMissingForEmail(email, d1Rows);
        return NextResponse.json(filled);
      }

      let employees: string[] = [];
      let addressMap = new Map<string, string>();
      let phoneMap = new Map<string, string | undefined | null>();
      if (isD1UsersEnabled()) {
        const users = await fetchAllUsers();
        employees = users.filter((u) => u.role === "employee").map((u) => u.email);
        phoneMap = new Map(users.map((u) => [u.email.toLowerCase(), u.phone]));
        
        try {
          const { listApplicationSummaries } = await import("@/lib/applications");
          const apps = await listApplicationSummaries();
          for (const app of apps) {
            if (app.email && app.currentAddress) {
              addressMap.set(app.email.toLowerCase(), app.currentAddress);
            }
          }
        } catch (e) {
          console.error("Failed to load addresses", e);
        }

        for (const row of d1Rows) {
          const lowerEmail = (row.email || "").toLowerCase();
          const phone = phoneMap.get(lowerEmail);
          if (phone) (row as any).phone = phone;

          const addr = addressMap.get(lowerEmail);
          if (addr) (row as any).currentAddress = addr;
        }
      }
      if (employees.length === 0) {
        employees = Array.from(new Set(d1Rows.map((r: any) => r.email).filter(Boolean)));
      }

      const filledAll: any[] = [];
      for (const emp of employees) {
        const rowsForEmp = d1Rows.filter((r: any) => r.email === emp);
        const lowerEmp = emp.toLowerCase();
        const phone = phoneMap.get(lowerEmp);
        const currentAddress = addressMap.get(lowerEmp);
        const filled = fillMissingForEmail(emp, rowsForEmp).map((r: any) => {
          return { ...r, phone, currentAddress };
        });
        filledAll.push(...filled);
      }

      filledAll.sort((a, b) => {
        const dA = parseISO(a.date).getTime();
        const dB = parseISO(b.date).getTime();
        if (dA !== dB) return dA - dB;
        return (a.fullName || a.email || "").localeCompare(b.fullName || b.email || "");
      });
      return NextResponse.json(filledAll);
    }
  }

  // Fallback: R2 Direct Listing (Legacy)
  try {
    const bucket = await getR2Binding();

    // Admin view: aggregate across employees
    if (!email) {
      // List all email segments under daily-reports/
      const listResponse = await bucket.list({
        prefix: "daily-reports/",
        delimiter: "/",
      });

      const emailSegments =
        listResponse.delimitedPrefixes?.map((p: any) => p.split("/")[1]).filter(Boolean) ?? [];

      const rows: any[] = [];
      for (const segment of emailSegments) {
        for (const day of days) {
          const dateStr = format(day, "yyyy-MM-dd");
          const key = `daily-reports/${segment}/${dateStr}/report.json`;
          const data = await getJson(bucket, key);
          const record = normalizeDailyReportRecord(segment, dateStr, data);
          const uploadedCount = countUploadedSlots(record);
          rows.push({
            appId: segment,
            fullName: (record as any).fullName || record.userEmail || segment,
            email: record.userEmail || segment,
            phone: null,
            date: dateStr,
            uploadedCount,
            totalSlots: TOTAL_DAILY_REPORT_SLOTS,
            status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
            lastUpdated: record.updatedAt,
          });
        }
      }
      return NextResponse.json(rows);
    }

    // Employee view: fetch per-day reports within range
    const emailSegment = sanitizeEmailForPath(email);
    const rows: any[] = [];

    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      const key = `daily-reports/${emailSegment}/${dateStr}/report.json`;
      const data = await getJson(bucket, key);
      const record = normalizeDailyReportRecord(email, dateStr, data);
      const uploadedCount = countUploadedSlots(record);
      rows.push({
        appId: email,
        fullName: email,
        email,
        phone: null,
        date: dateStr,
        uploadedCount,
        totalSlots: TOTAL_DAILY_REPORT_SLOTS,
        status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
        lastUpdated: record.updatedAt,
      });
    }

    return NextResponse.json(rows);

  } catch (error) {
    // Use Sample Data if R2 Fails (e.g. binding not found locally)
    if (!email) {
      const rows = days.flatMap((d) =>
        sampleAccounts
          .filter((acc) => acc.role === "employee")
          .map((acc) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const sample = getSampleDailyReport(acc.email, dateStr);
            const uploadedCount = sample.slots.filter((s) => s.r2Key || s.url).length;
            const app = sampleApplications.find((a) => a.appId === acc.appId);
            const status = getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS);
            return {
              appId: acc.appId ?? acc.email,
              fullName: acc.name,
              email: acc.email,
              phone: acc.phone ?? app?.phone ?? null,
              date: dateStr,
              uploadedCount,
              totalSlots: TOTAL_DAILY_REPORT_SLOTS,
              status,
            } as const;
          })
      );
      return NextResponse.json(rows);
    } else {
      const rows = days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const sample = getSampleDailyReport(email, dateStr);
        const uploadedCount = sample.slots.filter((s) => s.r2Key || s.url).length;
        return {
          appId: email,
          fullName: sample.userEmail,
          email,
          phone: null,
          date: dateStr,
          uploadedCount,
          totalSlots: TOTAL_DAILY_REPORT_SLOTS,
          status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
          lastUpdated: sample.updatedAt,
        };
      });
      return NextResponse.json(rows);
    }
  }
}
