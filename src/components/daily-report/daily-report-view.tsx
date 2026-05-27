"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { format, differenceInDays, startOfDay, parse } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { DailyReportSlotCard } from "./daily-report-slot-card";
import type {
  DailyReportResponse,
  DailyReportResponseSlot,
} from "@/lib/daily-report";
import {
  countUploadedResponseSlots,
  dailyReportSlotOrder,
  TOTAL_DAILY_REPORT_SLOTS,
} from "@/lib/daily-report";
import { getSampleDailyReport } from "@/data/sample-data";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Loader2, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type SlotUploadingState = Record<string, boolean>;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_CACHE_SIZE = 20; // Keep only 20 latest reports

export interface DailyReportViewProps {
  overrideDate?: Date;
  overrideEmail?: string;
  className?: string; // For styling flexibility
  onUpdate?: () => void;
}

export function DailyReportView({ overrideDate, overrideEmail, className, onUpdate }: DailyReportViewProps = {}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "god";
  const { toast } = useToast();

  const isPopupMode = !!(overrideDate || overrideEmail);

  const [selectedDate, setSelectedDate] = useState<Date>(() => overrideDate ?? new Date());
  const [selectedEmail, setSelectedEmail] = useState<string | null>(overrideEmail ?? null);
  const [userOptions, setUserOptions] = useState<{ email: string; name: string }[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => overrideDate ?? new Date());
  const [completedDates, setCompletedDates] = useState<Date[]>([]);

  // Sync props if they change (e.g. reused in dialog)
  useEffect(() => {
    if (overrideDate) {
      setSelectedDate(overrideDate);
      setCalendarMonth(overrideDate);
    }
  }, [overrideDate]);

  useEffect(() => {
    if (overrideEmail) {
      setSelectedEmail(overrideEmail);
    }
  }, [overrideEmail]);

  // Cache state
  const [reportCache, setReportCache] = useState<Record<string, DailyReportResponse>>({});

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [slotUploading, setSlotUploading] = useState<SlotUploadingState>({});
  const [slotDeleting, setSlotDeleting] = useState<SlotUploadingState>({});
  const [slotDescriptionSaving, setSlotDescriptionSaving] = useState<SlotUploadingState>({});
  const [isSampleData, setIsSampleData] = useState(false);

  // Worker Ref
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL("@/workers/image-processor.ts", import.meta.url));
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const selectedDateStr = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate]
  );

  const isReadOnly = useMemo(() => {
    if (isAdmin) return false;
    // Strict restriction: Non-admin can only edit TODAY's report
    // Using startOfDay to compare dates ignoring time
    const today = startOfDay(new Date());
    const target = startOfDay(selectedDate);
    // Allow if it's the same day. Any past or future date is read-only.
    return differenceInDays(today, target) !== 0;
  }, [selectedDate, isAdmin]);

  const cacheKey = `${selectedEmail ?? ""}:${selectedDateStr}`;
  const report = reportCache[cacheKey] ?? null;

  // Helper to update cache with LRU strategy
  const updateCache = useCallback((key: string, data: DailyReportResponse) => {
    setReportCache(prev => {
      const keys = Object.keys(prev);
      if (keys.includes(key)) {
        // Updated existing
        return { ...prev, [key]: data };
      }

      let newCache = { ...prev, [key]: data };
      if (keys.length >= MAX_CACHE_SIZE) {
        // Remove the oldest key (first one)
        const oldestKey = keys[0];
        const { [oldestKey]: _, ...rest } = newCache;
        return rest;
      }
      return newCache;
    });
  }, []);


  // Set default email
  useEffect(() => {
    if (!selectedEmail && user?.email) {
      setSelectedEmail(user.email);
    }
  }, [selectedEmail, user?.email]);

  // Load user options for admin
  useEffect(() => {
    if (!isAdmin) return;
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        if (!res.ok) return;
        const list = (await res.json()) as { email: string; name: string }[];
        setUserOptions(list);
        setSelectedEmail((prev) => prev ?? user?.email ?? list[0]?.email ?? null);
      } catch (error) {
        console.error("Failed to load users", error);
      }
    };
    void loadUsers();
  }, [isAdmin, user?.email]);

  // Fetch Summary for Calendar
  useEffect(() => {
    if (!selectedEmail) return;
    const fetchSummary = async () => {
      const monthStr = format(calendarMonth, "yyyy-MM");
      const query = new URLSearchParams({ email: selectedEmail, month: monthStr });
      try {
        const res = await fetch(`/api/daily-reports/summary?${query.toString()}`);
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          const datesStr: string[] = Array.isArray(payload?.completedDates)
            ? payload.completedDates
            : Array.isArray(payload)
              ? payload
                .filter((row: any) => ((row?.uploadedCount ?? 0) + (row?.extraUploadedCount ?? 0)) > 0)
                .map((row: any) => row?.date)
                .filter(Boolean)
              : [];
          const dates = datesStr.map((dateStr) => parse(dateStr, "yyyy-MM-dd", new Date()));
          setCompletedDates(dates);
        }
      } catch (error) {
        console.error("Failed to fetch report summary", error);
      }
    };
    void fetchSummary();
  }, [selectedEmail, calendarMonth]);

  const emptySlots = useMemo(
    () =>
      dailyReportSlotOrder.map((slot) => ({
        id: slot.id,
        label: slot.label,
        group: slot.group,
      })) as DailyReportResponseSlot[],
    []
  );

  const slots = report?.slots ?? emptySlots;
  const beforeSlots = slots.filter((slot) => slot.group === "before" || slot.id.startsWith("start"));
  const afterSlots = slots.filter((slot) => slot.group === "after" || slot.id.startsWith("end"));
  const extraSlots = slots.filter((slot) => slot.group === "extra");

  const loadReport = useCallback(async () => {
    if (!selectedEmail) return;
    if (reportCache[cacheKey]) return; // Use Cache

    setLoading(true);
    setFetchError(null);
    setIsSampleData(false);

    try {
      const query = new URLSearchParams({ email: selectedEmail, date: selectedDateStr });
      const res = await fetch(`/api/daily-reports?${query.toString()}`, { method: "GET", cache: "no-store" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "ไม่สามารถโหลดข้อมูลรายงานได้");
      }

      const data: DailyReportResponse = await res.json();
      updateCache(cacheKey, data);
    } catch (error) {
      console.error("[DailyReport] load error", error);
      if (selectedEmail) {
        const sample = getSampleDailyReport(selectedEmail, selectedDateStr);
        updateCache(cacheKey, sample);
        setIsSampleData(true);
        toast({ title: "แสดงข้อมูลตัวอย่าง", description: "ไม่สามารถเชื่อมต่อแหล่งข้อมูลจริงได้", });
      } else {
        // Remove from cache if error and no fallback
        setReportCache(prev => {
          const { [cacheKey]: _, ...rest } = prev;
          return rest;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDateStr, selectedEmail, toast, cacheKey, updateCache, reportCache]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const processFileInWorker = (file: File, id: string): Promise<{ file: File; md5: string }> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const msgHandler = (e: MessageEvent) => {
        if (e.data.id === id) {
          workerRef.current?.removeEventListener("message", msgHandler);
          if (e.data.type === "complete") {
            resolve({ file: e.data.file, md5: e.data.md5 });
          } else {
            reject(new Error(e.data.error || "Worker processing failed"));
          }
        }
      };

      workerRef.current.addEventListener("message", msgHandler);
      workerRef.current.postMessage({ type: "process", id, file });
    });
  };

  const handleFileUpload = useCallback(
    async (slotId: string, file: File) => {
      if (!selectedEmail) return;

      if (isSampleData) {
        toast({ variant: "destructive", title: "ไม่สามารถอัปโหลดไฟล์ได้", description: "โหมดทดลองใช้งาน" });
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "รูปแบบไฟล์ไม่ถูกต้อง", description: "รองรับเฉพาะ JPG, PNG, WEBP, HEIC" });
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast({ variant: "destructive", title: "ไฟล์ใหญ่เกินไป", description: "ขนาดไฟล์ต้องไม่เกิน 5MB" });
        return;
      }

      setSlotUploading((prev) => ({ ...prev, [slotId]: true }));

      try {
        // Use Worker for Compression & MD5
        const { file: workingFile, md5 } = await processFileInWorker(file, slotId);

        const signRes = await fetch("/api/daily-reports/sign-put", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedEmail,
            date: selectedDateStr,
            slotId,
            fileName: workingFile.name,
            mime: workingFile.type,
            size: workingFile.size,
            md5,
          }),
        });

        if (!signRes.ok) throw new Error("ไม่สามารถสร้างลิงก์อัปโหลดได้");
        const { url, key } = await signRes.json();

        const uploadRes = await fetch(url, {
          method: "PUT",
          body: workingFile,
          headers: { "Content-Type": workingFile.type, "Content-MD5": md5 },
        });

        if (!uploadRes.ok) throw new Error("อัปโหลดไม่สำเร็จ");

        // Extract the timestamp filename from R2 (e.g. "123456789.webp")
        const timestampName = key.split('/').pop() || workingFile.name;
        // Construct a readable filename: "check-in_123456789.webp"
        const r2FileName = `${slotId}_${timestampName}`;

        const saveRes = await fetch("/api/daily-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedEmail,
            date: selectedDateStr,
            slotId,
            r2Key: key,
            fileName: r2FileName, // Use the R2 filename for consistency
          }),
        });

        if (!saveRes.ok) throw new Error("ไม่สามารถบันทึกข้อมูลได้");

        const updated: DailyReportResponse = await saveRes.json();
        updateCache(cacheKey, updated);

        const uploadedCount = countUploadedResponseSlots(updated.slots);
        const extraUploadedCount = countUploadedResponseSlots(updated.slots, "extra");
        if (uploadedCount + extraUploadedCount > 0) {
          setCompletedDates(prev => {
            if (!prev.find(d => format(d, 'yyyy-MM-dd') === selectedDateStr)) return [...prev, selectedDate];
            return prev;
          });
        }

        toast({ title: "บันทึกเรียบร้อย", description: `${slots.find((slot) => slot.id === slotId)?.label || "รายการ"} ถูกอัปเดตแล้ว` });
        onUpdate?.();

      } catch (error) {
        console.error("[DailyReport] upload error", error);
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถอัปโหลดได้" });
      } finally {
        setSlotUploading((prev) => ({ ...prev, [slotId]: false }));
      }
    },
    [isSampleData, selectedEmail, selectedDate, selectedDateStr, slots, toast, cacheKey, updateCache, onUpdate]
  );

  const handleFileDelete = useCallback(
    async (slotId: string) => {
      if (!selectedEmail) return;
      if (isSampleData) {
        toast({ variant: "destructive", title: "ไม่สามารถลบไฟล์ได้", description: "โหมดทดลองใช้งาน" });
        return;
      }

      setSlotDeleting((prev) => ({ ...prev, [slotId]: true }));
      try {
        const res = await fetch("/api/daily-reports", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: selectedEmail, date: selectedDateStr, slotId }),
        });

        if (!res.ok) throw new Error("ไม่สามารถลบไฟล์ได้");

        const updated: DailyReportResponse = await res.json();
        updateCache(cacheKey, updated);

        const uploadedCount = countUploadedResponseSlots(updated.slots);
        const extraUploadedCount = countUploadedResponseSlots(updated.slots, "extra");
        if (uploadedCount + extraUploadedCount === 0) {
          setCompletedDates(prev => prev.filter(d => format(d, 'yyyy-MM-dd') !== selectedDateStr));
        }

        toast({ title: "ลบรูปภาพเรียบร้อย", description: `${slots.find((slot) => slot.id === slotId)?.label || "รายการ"} ถูกลบแล้ว` });
        onUpdate?.();
      } catch (error) {
        console.error("[DailyReport] delete error", error);
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถลบได้" });
      } finally {
        setSlotDeleting((prev) => ({ ...prev, [slotId]: false }));
      }
    },
    [isSampleData, selectedEmail, selectedDateStr, slots, toast, cacheKey, updateCache, onUpdate]
  );

  const handleDescriptionSave = useCallback(
    async (slotId: string, description: string) => {
      if (!selectedEmail) return;
      if (isSampleData) {
        toast({ variant: "destructive", title: "ไม่สามารถบันทึกคำอธิบายได้", description: "โหมดทดลองใช้งาน" });
        return;
      }

      setSlotDescriptionSaving((prev) => ({ ...prev, [slotId]: true }));
      try {
        const res = await fetch("/api/daily-reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: selectedEmail, date: selectedDateStr, slotId, description }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "ไม่สามารถบันทึกคำอธิบายได้");
        }

        const updated: DailyReportResponse = await res.json();
        updateCache(cacheKey, updated);
        toast({ title: "บันทึกคำอธิบายเรียบร้อย" });
        onUpdate?.();
      } catch (error) {
        console.error("[DailyReport] description save error", error);
        toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถบันทึกคำอธิบายได้" });
      } finally {
        setSlotDescriptionSaving((prev) => ({ ...prev, [slotId]: false }));
      }
    },
    [cacheKey, isSampleData, onUpdate, selectedDateStr, selectedEmail, toast, updateCache]
  );

  if (!selectedEmail) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <h1 className="text-2xl font-semibold">จำเป็นต้องเข้าสู่ระบบ</h1>
        <p className="mt-2 text-muted-foreground">กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานเพื่อบันทึก Daily Report</p>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6", className)}>
      {!isPopupMode && (
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Daily Report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            บันทึกข้อมูลพร้อมรูปภาพประกอบของการปฏิบัติงานแต่ละขั้นตอน สามารถอัปโหลดเพิ่มได้ตลอดวัน
          </p>
        </div>
      )}

      {!isPopupMode && (
        <div className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="daily-report-date">เลือกวันที่</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                  modifiers={{ completed: completedDates }}
                  modifiersStyles={{ completed: { color: "var(--primary)", fontWeight: "bold", textDecoration: "underline" } }}
                  onMonthChange={setCalendarMonth}
                />
              </PopoverContent>
            </Popover>
          </div>

          {isAdmin && (
            <div className="space-y-2 md:w-[300px]">
              <Label htmlFor="employee-select">เลือกพนักงาน (Admin)</Label>
              <Select value={selectedEmail} onValueChange={setSelectedEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกพนักงาน" />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map(u => (
                    <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={loadReport}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      )}

      {fetchError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )
      }

      {
        loading && !report && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )
      }

      {
        !loading && (
          <div className="space-y-8">
            {/* Before Start */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b pb-2">ก่อนเริ่มงาน</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {beforeSlots.map(slot => (
                  <DailyReportSlotCard
                    key={slot.id}
                    slot={slot}
                    uploading={slotUploading[slot.id]}
                    deleting={slotDeleting[slot.id]}
                    descriptionSaving={slotDescriptionSaving[slot.id]}
                    onUpload={(file) => handleFileUpload(slot.id, file)}
                    onDelete={() => handleFileDelete(slot.id)}
                    disabled={isReadOnly}
                    disabledReason="ไม่สามารถแก้ไขย้อนหลังได้"
                  />
                ))}
              </div>
            </div>

            {/* After End */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b pb-2">หลังเลิกงาน</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {afterSlots.map(slot => (
                  <DailyReportSlotCard
                    key={slot.id}
                    slot={slot}
                    uploading={slotUploading[slot.id]}
                    deleting={slotDeleting[slot.id]}
                    descriptionSaving={slotDescriptionSaving[slot.id]}
                    onUpload={(file) => handleFileUpload(slot.id, file)}
                    onDelete={() => handleFileDelete(slot.id)}
                    disabled={isReadOnly}
                    disabledReason="ไม่สามารถแก้ไขย้อนหลังได้"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 border-b pb-2">
                <h2 className="text-xl font-semibold">อื่นๆ</h2>
                <p className="text-sm text-muted-foreground">
                  อัปโหลดรูปเพิ่มเติมได้อีก 2 รูป พร้อมใส่รายละเอียดได้แบบไม่บังคับ โดยไม่นับรวมใน 6 รูปหลัก
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                {extraSlots.map(slot => (
                  <DailyReportSlotCard
                    key={slot.id}
                    slot={slot}
                    uploading={slotUploading[slot.id]}
                    deleting={slotDeleting[slot.id]}
                    descriptionSaving={slotDescriptionSaving[slot.id]}
                    onUpload={(file) => handleFileUpload(slot.id, file)}
                    onDelete={() => handleFileDelete(slot.id)}
                    onDescriptionSave={(description) => handleDescriptionSave(slot.id, description)}
                    disabled={isReadOnly}
                    disabledReason="ไม่สามารถแก้ไขย้อนหลังได้"
                    showDescriptionField
                  />
                ))}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
