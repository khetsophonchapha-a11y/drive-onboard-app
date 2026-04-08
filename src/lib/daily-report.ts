import { z } from "zod";

export const dailyReportSlotOrder = [
  { id: "check-in", label: "Check in ลงชื่อเข้างาน", group: "before" },
  { id: "pre-delivery", label: "ข้อมูลการจัดส่ง ก่อนเริ่มงาน", group: "before" },
  { id: "check-out", label: "Check Out ลงชื่อออกงาน", group: "after" },
  { id: "post-delivery", label: "ข้อมูลการจัดส่ง หลังจบงาน", group: "after" },
  { id: "suspension", label: 'ข้อมูลการ "ระงับ"', group: "after" },
  { id: "payment-proof", label: "หลักฐานการโอนเงิน", group: "after" },
] as const;

export const DailyReportDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "รูปแบบวันที่ต้องเป็น YYYY-MM-DD" });

export const DailyReportEmailSchema = z.string().email();

export const dailyReportSlotIds = dailyReportSlotOrder.map((slot) => slot.id) as [
  "check-in",
  "pre-delivery",
  "check-out",
  "post-delivery",
  "suspension",
  "payment-proof"
];

export type DailyReportSlotId = typeof dailyReportSlotIds[number];
export type DailyReportSlotGroup = (typeof dailyReportSlotOrder)[number]["group"];

export interface DailyReportSlot {
  id: DailyReportSlotId;
  label: string;
  group?: DailyReportSlotGroup;
  r2Key?: string;
  fileName?: string;
  uploadedAt?: string;
}

export interface DailyReportRecord {
  userEmail: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  slots: Record<DailyReportSlotId, DailyReportSlot>;
}

export interface DailyReportResponseSlot extends DailyReportSlot {
  url?: string;
}

export interface DailyReportResponse {
  userEmail: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  slots: DailyReportResponseSlot[];
}

export function createEmptyDailyReport(userEmail: string, date: string): DailyReportRecord {
  const timestamp = new Date().toISOString();
  const slots = dailyReportSlotOrder.reduce(
    (acc, slot) => {
      acc[slot.id] = {
        id: slot.id,
        label: slot.label,
        group: slot.group,
      };
      return acc;
    },
    {} as Record<DailyReportSlotId, DailyReportSlot>
  );

  return {
    userEmail,
    date,
    createdAt: timestamp,
    updatedAt: timestamp,
    slots,
  };
}

export function sanitizeEmailForPath(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export function normalizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export const TOTAL_DAILY_REPORT_SLOTS = dailyReportSlotOrder.length;

export function normalizeDailyReportRecord(
  userEmail: string,
  date: string,
  data: any | null
): DailyReportRecord {
  if (!data) {
    return createEmptyDailyReport(userEmail, date);
  }

  const record = data as DailyReportRecord;
  if (!record.userEmail) {
    record.userEmail = userEmail;
  }
  if (!record.date) {
    record.date = date;
  }
  if (!record.createdAt) {
    record.createdAt = new Date().toISOString();
  }
  if (!record.updatedAt) {
    record.updatedAt = record.createdAt;
  }
  if (!record.slots) {
    record.slots = {} as DailyReportRecord["slots"];
  }

  for (const slot of dailyReportSlotOrder) {
    if (!record.slots[slot.id]) {
      record.slots[slot.id] = {
        id: slot.id,
        label: slot.label,
        group: slot.group,
      };
    } else {
      record.slots[slot.id].label = slot.label;
      record.slots[slot.id].group = slot.group;
    }
  }

  return record;
}

export function countUploadedSlots(record: DailyReportRecord): number {
  return dailyReportSlotOrder.reduce((count, slot) => {
    const slotData = record.slots[slot.id];
    return slotData?.r2Key ? count + 1 : count;
  }, 0);
}

export type DailyReportProgressStatus = "missing" | "partial" | "complete";

export interface DailyReportSummaryRow {
  appId: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  currentAddress?: string | null;
  date: string;
  uploadedCount: number;
  totalSlots: number;
  lastUpdated?: string;
  status: DailyReportProgressStatus;
  notes?: string;
}

export function getDailyReportProgressStatus(
  uploadedCount: number,
  totalSlots: number
): DailyReportProgressStatus {
  if (uploadedCount === 0) {
    return "missing";
  }
  if (uploadedCount >= totalSlots) {
    return "complete";
  }
  return "partial";
}
