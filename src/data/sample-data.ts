import type { AppRow, Manifest } from "@/lib/types";
import type {
  DailyReportResponse,
  DailyReportSlotId,
} from "@/lib/daily-report";
import {
  createEmptyDailyReport,
  dailyReportSlotOrder,
} from "@/lib/daily-report";

type SampleRole = "admin" | "employee";

export interface SampleAccount {
  email: string;
  password: string;
  name: string;
  role: SampleRole;
  avatarUrl?: string;
  phone?: string;
  appId?: string;
  dailyReportSlots?: DailyReportSlotId[];
  prefix?: string;
}

const SLOT_PLACEHOLDERS: Record<DailyReportSlotId, string> = {
  "check-in":
    "https://images.unsplash.com/photo-1529429617124-aee3b6e0f156?auto=format&fit=crop&w=800&q=60",
  "pre-delivery":
    "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=60",
  "check-out":
    "https://images.unsplash.com/photo-1576013551627-0cc20b96c3c3?auto=format&fit=crop&w=800&q=60",
  "post-delivery":
    "https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=800&q=60",
  "suspension":
    "https://images.unsplash.com/photo-1503424886300-4ce5a5438e02?auto=format&fit=crop&w=800&q=60",
  "payment-proof":
    "https://images.unsplash.com/photo-1523289333742-be1143f6b766?auto=format&fit=crop&w=800&q=60",
};

export const sampleAdminAccount: SampleAccount = {
  email: "admin@driveonboard.test",
  password: "Admin123!",
  name: "ผู้ดูแลระบบ",
  role: "admin",
  avatarUrl: "https://i.pravatar.cc/150?img=68",
};

export const sampleEmployeeAccounts: SampleAccount[] = [
  {
    email: "driver.nattha@driveonboard.test",
    password: "Driver123!",
    name: "ณัฐพงษ์ ใจดี",
    role: "employee",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    phone: "081-345-6789",
    appId: "app-driver-001",
    dailyReportSlots: ["check-in", "pre-delivery", "check-out"],
  },
  {
    email: "driver.saranya@driveonboard.test",
    password: "Driver123!",
    name: "สรัญญา สุขกาย",
    role: "employee",
    avatarUrl: "https://i.pravatar.cc/150?img=48",
    phone: "089-654-3210",
    appId: "app-driver-002",
    dailyReportSlots: [
      "check-in",
      "pre-delivery",
      "check-out",
      "post-delivery",
    ],
    prefix: "นางสาว",
  },
  {
    email: "driver.chaiwat@driveonboard.test",
    password: "Driver123!",
    name: "ไชยวัฒน์ มั่นใจ",
    role: "employee",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    phone: "086-111-2233",
    appId: "app-driver-003",
    dailyReportSlots: [
      "check-in",
      "pre-delivery",
      "check-out",
      "post-delivery",
      "suspension",
      "payment-proof",
    ],
    prefix: "นาย",
  },
];

export const sampleAccounts: SampleAccount[] = [
  sampleAdminAccount,
  ...sampleEmployeeAccounts,
];

export const sampleApplications: AppRow[] = sampleEmployeeAccounts.map(
  (employee, index) => ({
    appId: employee.appId ?? `sample-app-${index + 1}`,
    fullName: employee.name,
    email: employee.email,
    phone: employee.phone,
    createdAt: new Date(2025, 1, 1 + index).toISOString(),
    status: "approved",
  })
);

export const sampleManifests: Record<string, Manifest> =
  sampleEmployeeAccounts.reduce<Record<string, Manifest>>((acc, employee) => {
    const [firstName, ...rest] = employee.name.split(" ");
    const lastName = rest.join(" ") || "ไม่ทราบนามสกุล";
    const createdAt = new Date(2025, 1, 1).toISOString();

    if (employee.appId) {
      acc[employee.appId] = {
        appId: employee.appId,
        createdAt,
        applicant: {
          prefix: employee.prefix ?? "นาย",
          firstName,
          lastName,
          fullName: employee.name,
          mobilePhone: employee.phone,
          email: employee.email,
        },
        applicationDetails: {
          position: "พนักงานขับรถ",
          applicationDate: new Date(createdAt),
        },
        status: {
          completeness: "complete",
          verification: "approved",
        },
      } as Manifest;
    }

    return acc;
  }, {});

export function getSampleDailyReport(
  email: string,
  date: string
): DailyReportResponse {
  const employee = sampleEmployeeAccounts.find(
    (account) => account.email.toLowerCase() === email.toLowerCase()
  );

  const record = createEmptyDailyReport(email, date);
  record.createdAt = new Date(`${date}T08:00:00Z`).toISOString();
  record.updatedAt = new Date(`${date}T17:00:00Z`).toISOString();

  const uploadedSlots = new Set(employee?.dailyReportSlots ?? []);
  const responseSlots = dailyReportSlotOrder.map((slot, index) => {
    const base = record.slots[slot.id];
    if (uploadedSlots.has(slot.id)) {
      base.r2Key = `sample/${employee?.appId ?? "demo"}/${slot.id}.jpg`;
      base.fileName = `${slot.label}.jpg`;
      const hour = String(index + 8).padStart(2, "0");
      base.uploadedAt = new Date(`${date}T${hour}:15:00Z`).toISOString();
    }

    return {
      ...base,
      url: uploadedSlots.has(slot.id)
        ? SLOT_PLACEHOLDERS[slot.id]
        : undefined,
    };
  });

  return {
    userEmail: record.userEmail,
    date: record.date,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    slots: responseSlots,
  };
}
