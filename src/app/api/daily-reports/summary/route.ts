import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getR2Binding } from "@/lib/r2/binding";
import { getLatestApplicationContactMap, normalizeEmail } from "@/lib/applications";
import {
  type DailyReportSummaryRow,
  countUploadedExtraSlots,
  countUploadedSlots,
  getDailyReportReportKey,
  normalizeDailyReportRecord,
  TOTAL_DAILY_REPORT_SLOTS,
  getDailyReportProgressStatus,
} from "@/lib/daily-report";
import { sampleAccounts, sampleApplications, getSampleDailyReport } from "@/data/sample-data";
import { parseISO, eachDayOfInterval, startOfMonth, endOfMonth, format } from "date-fns";
import { fetchDailyReportSummaryRange, isD1DailyReportEnabled } from "@/lib/d1-daily-report";
import { fetchAllUsers, isD1UsersEnabled } from "@/lib/d1-users";
import { fetchAllHubs } from "@/lib/d1-hubs";

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
  if (role !== "admin" && role !== "employee" && role !== "god") {
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
    const d1Rows = (await fetchDailyReportSummaryRange(
      clampedStartStr,
      clampedEndStr,
      email
    )) as DailyReportSummaryRow[] | null;
    if (d1Rows) {
      const contactMap = await getLatestApplicationContactMap();
      const getContact = (targetEmail: string) => contactMap.get(normalizeEmail(targetEmail));
      const hubs = await fetchAllHubs().catch(() => []);
      const hubMap = new Map(hubs.map((h) => [h.id, h.name]));

      const fillMissingForEmail = (targetEmail: string, sourceRows: any[]): any[] => {
        const byDate = new Map(sourceRows.map((r) => [r.date, r]));
        const contact = getContact(targetEmail);
        return days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const existing = byDate.get(dateStr);
          if (existing) {
            return {
              ...existing,
              fullName: existing.fullName || contact?.fullName || targetEmail,
              phone: existing.phone ?? contact?.phone ?? null,
              currentAddressText: existing.currentAddressText ?? contact?.currentAddressText ?? null,
            };
          }
          return {
            appId: targetEmail,
            fullName: contact?.fullName || targetEmail,
            email: targetEmail,
            phone: contact?.phone ?? null,
            currentAddressText: contact?.currentAddressText ?? null,
            date: dateStr,
            uploadedCount: 0,
            totalSlots: TOTAL_DAILY_REPORT_SLOTS,
            status: "missing",
            lastUpdated: undefined,
            notes: undefined,
            hubId: contact?.hubId ?? null,
            hubName: contact?.hubId ? hubMap.get(contact.hubId) ?? null : null,
          };
        });
      };

      if (email) {
        const filled = fillMissingForEmail(email, d1Rows);
        return NextResponse.json(filled);
      }

      let employees: string[] = [];
      if (isD1UsersEnabled()) {
        const users = await fetchAllUsers();
        const employeeEmailMap = new Map<string, string>();
        const userHubMap = new Map<string, string | null>();
        for (const summaryUser of users) {
          if (summaryUser.role !== "employee") continue;
          const normEmail = normalizeEmail(summaryUser.email);
          employeeEmailMap.set(normEmail, summaryUser.email);
          userHubMap.set(normEmail, summaryUser.hubId ?? null);
        }
        employees = Array.from(employeeEmailMap.values());
        const phoneMap = new Map(users.map((u) => [u.email.toLowerCase(), u.phone]));
        for (const row of d1Rows) {
          const normalizedEmail = normalizeEmail(row.email || "");
          const phone = phoneMap.get(normalizedEmail);
          const hubId = userHubMap.get(normalizedEmail) ?? null;
          const contact = getContact(row.email || "");
          if (phone) (row as any).phone = phone;
          else if (contact?.phone) (row as any).phone = contact.phone;
          
          if (hubId) {
            (row as any).hubId = hubId;
            (row as any).hubName = hubMap.get(hubId) ?? null;
          }

          if (contact?.currentAddressText) (row as any).currentAddressText = contact.currentAddressText;
          if ((!row.fullName || row.fullName === row.email) && contact?.fullName) {
            (row as any).fullName = contact.fullName;
          }
        }
      }
      if (employees.length === 0) {
        employees = Array.from(
          new Set(
            d1Rows
              .map((r) => r.email)
              .filter((candidate): candidate is string => Boolean(candidate))
              .map((candidate) => normalizeEmail(candidate))
          )
        );
      }

      const filledAll: any[] = [];
      for (const emp of employees) {
        const normalizedEmp = normalizeEmail(emp);
        const rowsForEmp = d1Rows.filter(
          (r: DailyReportSummaryRow) => normalizeEmail(r.email || "") === normalizedEmp
        );
        const filled = fillMissingForEmail(emp, rowsForEmp).map((r: DailyReportSummaryRow) => {
          const contact = getContact(emp);
          const phone =
            rowsForEmp.find((rr: DailyReportSummaryRow) => rr.phone)?.phone ??
            contact?.phone ??
            null;
          const currentAddressText =
            rowsForEmp.find((rr: DailyReportSummaryRow) => rr.currentAddressText)
              ?.currentAddressText ??
            contact?.currentAddressText ??
            null;
          
          const hubId = userHubMap?.get(normalizedEmp) ?? null;
          const hubName = hubId ? hubMap.get(hubId) ?? null : null;

          return { ...r, phone, currentAddressText, hubId, hubName };
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
    const contactMap = await getLatestApplicationContactMap();
    const getContact = (targetEmail: string) => contactMap.get(normalizeEmail(targetEmail));

    // Admin view: aggregate across employees
    if (!email) {
      // List all email segments under daily-reports/
      const listResponse = await bucket.list({
        prefix: "daily-reports/",
        delimiter: "/",
      });

      const emailSegments =
        listResponse.delimitedPrefixes
          ?.map((prefix: string) => prefix.split("/")[1])
          .filter((candidate: string | undefined): candidate is string => Boolean(candidate)) ?? [];

      const rows: any[] = [];
      for (const segment of emailSegments) {
        for (const day of days) {
          const dateStr = format(day, "yyyy-MM-dd");
          const key = `daily-reports/${segment}/${dateStr}/report.json`;
          const data = await getJson(bucket, key);
          const record = normalizeDailyReportRecord(segment, dateStr, data);
          const uploadedCount = countUploadedSlots(record);
          const extraUploadedCount = countUploadedExtraSlots(record);
          const contact = record.userEmail ? getContact(record.userEmail) : undefined;
          rows.push({
            appId: segment,
            fullName: (record as any).fullName || contact?.fullName || record.userEmail || segment,
            email: record.userEmail || segment,
            phone: null,
            currentAddressText: contact?.currentAddressText ?? null,
            date: dateStr,
            uploadedCount,
            extraUploadedCount,
            totalSlots: TOTAL_DAILY_REPORT_SLOTS,
            status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
            lastUpdated: record.updatedAt,
          });
        }
      }
      return NextResponse.json(rows);
    }

    // Employee view: fetch per-day reports within range
    const rows: any[] = [];

    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      const key = getDailyReportReportKey(email, dateStr);
      const data = await getJson(bucket, key);
      const record = normalizeDailyReportRecord(email, dateStr, data);
      const uploadedCount = countUploadedSlots(record);
      const extraUploadedCount = countUploadedExtraSlots(record);
      const contact = getContact(email);
      rows.push({
        appId: email,
        fullName: contact?.fullName || email,
        email,
        phone: contact?.phone ?? null,
        currentAddressText: contact?.currentAddressText ?? null,
        date: dateStr,
        uploadedCount,
        extraUploadedCount,
        totalSlots: TOTAL_DAILY_REPORT_SLOTS,
        status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
        lastUpdated: record.updatedAt,
      });
    }

    return NextResponse.json(rows);

  } catch (error) {
    // Use Sample Data if R2 Fails (e.g. binding not found locally)
    const contactMap = await getLatestApplicationContactMap();
    const getContact = (targetEmail: string) => contactMap.get(normalizeEmail(targetEmail));
    if (!email) {
      const rows = days.flatMap((d) =>
        sampleAccounts
          .filter((acc) => acc.role === "employee")
          .map((acc) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const sample = getSampleDailyReport(acc.email, dateStr);
            const uploadedCount = sample.slots.filter((s) => s.r2Key && s.group !== "extra").length;
            const extraUploadedCount = sample.slots.filter((s) => s.r2Key && s.group === "extra").length;
            const app = sampleApplications.find((a) => a.appId === acc.appId);
            const status = getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS);
            const contact = getContact(acc.email);
            return {
              appId: acc.appId ?? acc.email,
              fullName: contact?.fullName || acc.name,
              email: acc.email,
              phone: acc.phone ?? app?.phone ?? null,
              currentAddressText: contact?.currentAddressText ?? null,
              date: dateStr,
              uploadedCount,
              extraUploadedCount,
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
        const uploadedCount = sample.slots.filter((s) => s.r2Key && s.group !== "extra").length;
        const extraUploadedCount = sample.slots.filter((s) => s.r2Key && s.group === "extra").length;
        const contact = getContact(email);
        return {
          appId: email,
          fullName: contact?.fullName || sample.userEmail,
          email,
          phone: contact?.phone ?? null,
          currentAddressText: contact?.currentAddressText ?? null,
          date: dateStr,
          uploadedCount,
          extraUploadedCount,
          totalSlots: TOTAL_DAILY_REPORT_SLOTS,
          status: getDailyReportProgressStatus(uploadedCount, TOTAL_DAILY_REPORT_SLOTS),
          lastUpdated: sample.updatedAt,
        };
      });
      return NextResponse.json(rows);
    }
  }
}
