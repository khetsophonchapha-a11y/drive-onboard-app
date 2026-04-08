"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckCircle2, CircleAlert, Loader2, PhoneCall, Mail, Download, RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from "lucide-react";
import { DailyReportSummaryRow, TOTAL_DAILY_REPORT_SLOTS } from "@/lib/daily-report";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type StatusFilter = "all" | "uploaded" | "partial" | "missing" | "complete";

interface DailyReportTrackerProps {
  initialDate: string; // month or start date string (yyyy-MM or yyyy-MM-dd)
  initialStartDate?: string;
  initialEndDate?: string;
  initialRows: DailyReportSummaryRow[];
  userEmail?: string;
  userRole?: string;
}

const normalizeRows = (value: unknown): DailyReportSummaryRow[] =>
  Array.isArray(value)
    ? value.map((row) => {
      const summaryRow = row as Partial<DailyReportSummaryRow>;
      const uploadedCount =
        typeof summaryRow.uploadedCount === "number" && Number.isFinite(summaryRow.uploadedCount)
          ? summaryRow.uploadedCount
          : 0;
      const totalSlots =
        typeof summaryRow.totalSlots === "number" && Number.isFinite(summaryRow.totalSlots) && summaryRow.totalSlots > 0
          ? summaryRow.totalSlots
          : TOTAL_DAILY_REPORT_SLOTS;

      return {
        ...summaryRow,
        uploadedCount,
        totalSlots,
      } as DailyReportSummaryRow;
    })
    : [];

import { DailyReportView } from "@/components/daily-report/daily-report-view";

// ... existing imports

export function DailyReportTracker({
  initialDate,
  initialStartDate,
  initialEndDate,
  initialRows,
  userEmail,
  userRole,
}: DailyReportTrackerProps) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isAdmin = userRole === "admin";
  const [rows, setRows] = useState<DailyReportSummaryRow[]>(normalizeRows(initialRows));
  const [startDate, setStartDate] = useState(
    (initialStartDate ?? initialDate) > todayStr ? todayStr : initialStartDate ?? initialDate
  );
  const [endDate, setEndDate] = useState(
    (initialEndDate ?? initialDate) > todayStr ? todayStr : initialEndDate ?? initialDate
  );
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filtering & Sorting State
  const [nameFilter, setNameFilter] = useState<string>("");
  const [debouncedNameFilter, setDebouncedNameFilter] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const observerTarget = useRef<HTMLDivElement>(null);

  const [selectedReport, setSelectedReport] = useState<DailyReportSummaryRow | null>(null);
  const { toast } = useToast();

  // Debounce Name Filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNameFilter(nameFilter);
      setVisibleCount(50); // Reset visible count on filter change
    }, 400); // 400ms delay

    return () => clearTimeout(timer);
  }, [nameFilter]);

  // Reset visible count on other filter changes
  useEffect(() => {
    setVisibleCount(50);
  }, [statusFilter, startDate, endDate, sortConfig]);

  useEffect(() => {
    setRows(normalizeRows(initialRows));
  }, [initialRows]);

  useEffect(() => {
    if (startDate && endDate) {
      void fetchSummary({ start: startDate, end: endDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, userEmail, userRole]);

  const fetchSummary = async ({ start, end }: { start: string; end: string }) => {
    try {
      setLoading(true);
      const query = new URLSearchParams(
        isAdmin
          ? { startDate: start, endDate: end }
          : { email: userEmail ?? "", startDate: start, endDate: end }
      );
      const url = `/api/daily-reports/summary?${query.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "ไม่สามารถโหลดข้อมูลได้");
      }
      const data = await res.json();
      setRows(normalizeRows(data));
    } catch (error) {
      console.error("[DailyReportTracker] summary fetch error", error);
      toast({
        variant: "destructive",
        title: "โหลดข้อมูลสรุปไม่สำเร็จ",
        description:
          error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = async (value: string, field: "start" | "end") => {
    const clamped = value > todayStr ? todayStr : value;
    const nextStart = field === "start" ? clamped : startDate;
    const nextEnd = field === "end" ? clamped : endDate;

    if (field === "start") {
      setStartDate(nextStart);
    } else {
      setEndDate(nextEnd);
    }

    if (!nextStart || !nextEnd) {
      setRows([]);
      return;
    }

    await fetchSummary({ start: nextStart, end: nextEnd });
  };

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredRows = useMemo(() => {
    const term = debouncedNameFilter.trim().toLowerCase();
    const result = rows.filter((row) => {
      switch (statusFilter) {
        case "uploaded":
          return row.uploadedCount > 0;
        case "partial":
          return row.status === "partial";
        case "missing":
          return row.status === "missing";
        case "complete":
          return row.status === "complete";
        default:
          return true;
      }
    }).filter((row) => {
      if (!term) return true;
      return (
        row.fullName.toLowerCase().includes(term) ||
        (row.email ?? "").toLowerCase().includes(term)
      );
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case 'date':
          const dA = parseISO(a.date).getTime();
          const dB = parseISO(b.date).getTime();
          comparison = dA - dB;
          break;
        case 'name':
          comparison = a.fullName.localeCompare(b.fullName);
          break;
        case 'uploaded':
          comparison = a.uploadedCount - b.uploadedCount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastUpdated':
          const tA = a.lastUpdated ? parseISO(a.lastUpdated).getTime() : 0;
          const tB = b.lastUpdated ? parseISO(b.lastUpdated).getTime() : 0;
          comparison = tA - tB;
          break;
        default:
          comparison = 0;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [rows, statusFilter, debouncedNameFilter, sortConfig]);

  const visibleRows = useMemo(() => {
    return filteredRows.slice(0, visibleCount);
  }, [filteredRows, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredRows.length) {
          setVisibleCount((prev) => Math.min(prev + 50, filteredRows.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [visibleCount, filteredRows.length]);

  const statusBadge = (row: DailyReportSummaryRow) => {
    switch (row.status) {
      case "complete":
        return (
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            ครบแล้ว
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="secondary">
            <CalendarIcon className="mr-1 h-3.5 w-3.5" />
            ยังไม่ครบ
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <CircleAlert className="mr-1 h-3.5 w-3.5" />
            ยังไม่มีข้อมูล
          </Badge>
        );
    }
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="daily-report-summary-start">วันที่เริ่ม</Label>
          <Input
            id="daily-report-summary-start"
            type="date"
            value={startDate}
            onChange={(event) => void handleDateChange(event.target.value, "start")}
            className="max-w-xs"
            max={todayStr}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="daily-report-summary-end">วันที่สิ้นสุด</Label>
          <Input
            id="daily-report-summary-end"
            type="date"
            value={endDate}
            onChange={(event) => void handleDateChange(event.target.value, "end")}
            className="max-w-xs"
            max={todayStr}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label>กรองสถานะ</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="เลือกตัวกรอง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="uploaded">แนบแล้ว</SelectItem>
              <SelectItem value="partial">แนบแล้วยังไม่ครบ</SelectItem>
              <SelectItem value="missing">ยังไม่มีข้อมูล</SelectItem>
              <SelectItem value="complete">ครบแล้ว</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => startDate && endDate && void fetchSummary({ start: startDate, end: endDate })}
            disabled={loading || !startDate || !endDate}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            รีเฟรช
          </Button>
          <Button
            type="button"
            variant="default" // Use default (primary) for Export to make it stand out
            onClick={() => {
              if (filteredRows.length === 0) return;

              // CSV Generation Logic
              const headers = ["Date", "Name", "Email", "Uploaded", "Total", "Status", "Last Updated", "Notes"];
              const csvContent = [
                headers.join(","),
                ...filteredRows.map(row => [
                  `"${row.date}"`,
                  `"${row.fullName.replace(/"/g, '""')}"`,
                  `"${row.email || ""}"`,
                  row.uploadedCount,
                  row.totalSlots,
                  row.status,
                  `"${row.lastUpdated ? format(parseISO(row.lastUpdated), "yyyy-MM-dd HH:mm") : ""}"`,
                  `"${(row.notes || "").replace(/"/g, '""')}"`
                ].join(","))
              ].join("\n");

              // Trigger Download
              const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", `daily_report_${startDate}_to_${endDate}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            disabled={loading || filteredRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        {isAdmin && (
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="daily-report-name-filter">กรองชื่อ/อีเมล</Label>
            <Input
              id="daily-report-name-filter"
              placeholder="ค้นหาชื่อหรืออีเมล"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        )}
      </div>

      <div className="rounded-md border h-[600px] overflow-y-auto relative">
        <table className="w-full text-sm text-left">
          <TableHeader className="sticky top-0 z-20 shadow-sm">
            <TableRow className="bg-secondary hover:bg-secondary">
              <TableHead className="w-[160px] font-semibold text-secondary-foreground">
                <Button variant="ghost" className="h-8 -ml-3 hover:bg-transparent hover:text-secondary-foreground" onClick={() => handleSort('date')}>
                  <span>วันที่</span>
                  {sortConfig.key === 'date' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                  ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-secondary-foreground">
                <Button variant="ghost" className="h-8 -ml-3 hover:bg-transparent hover:text-secondary-foreground" onClick={() => handleSort('name')}>
                  <span>ชื่อ-นามสกุล</span>
                  {sortConfig.key === 'name' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                  ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                </Button>
              </TableHead>
              <TableHead className="w-[140px] text-center font-semibold text-secondary-foreground">
                <Button variant="ghost" className="h-8 hover:bg-transparent hover:text-secondary-foreground" onClick={() => handleSort('uploaded')}>
                  <span>จำนวนรูป</span>
                  {sortConfig.key === 'uploaded' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                  ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                </Button>
              </TableHead>
              <TableHead className="w-[140px] text-center font-semibold text-secondary-foreground">
                <Button variant="ghost" className="h-8 hover:bg-transparent hover:text-secondary-foreground" onClick={() => handleSort('status')}>
                  <span>สถานะ</span>
                  {sortConfig.key === 'status' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                  ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                </Button>
              </TableHead>
              <TableHead className="w-[200px] font-semibold text-secondary-foreground">
                <Button variant="ghost" className="h-8 -ml-3 hover:bg-transparent hover:text-secondary-foreground" onClick={() => handleSort('lastUpdated')}>
                  <span>อัปเดตล่าสุด</span>
                  {sortConfig.key === 'lastUpdated' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                  ) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-secondary-foreground">หมายเหตุ</TableHead>
              <TableHead className="w-[140px] text-center font-semibold text-secondary-foreground">ติดต่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="mx-auto h-9 w-24" />
                  </TableCell>
                </TableRow>
              ))
              : visibleRows.length > 0
                ? visibleRows.map((row, idx) => (
                  <TableRow
                    key={`${row.appId}-${row.date}-${idx}`}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={(e) => {
                      // Prevent opening if clicking on action buttons
                      if ((e.target as HTMLElement).closest("button")) return;
                      setSelectedReport(row);
                    }}
                  >
                    <TableCell>
                      {format(parseISO(row.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {row.fullName}
                        </span>
                        {row.email && (
                          <span className="text-xs text-muted-foreground">
                            {row.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium text-foreground">
                      {row.uploadedCount >= row.totalSlots 
                        ? `${row.totalSlots}/${row.totalSlots}` 
                        : `${row.uploadedCount}/${row.totalSlots}`}
                    </TableCell>
                    <TableCell className="text-center">
                      {statusBadge(row)}
                    </TableCell>
                    <TableCell>
                      {row.lastUpdated
                        ? format(parseISO(row.lastUpdated), "dd MMM yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.notes ??
                        (row.uploadedCount === row.totalSlots
                          ? "ครบถ้วน"
                          : row.uploadedCount === 0
                            ? "ยังไม่มีการอัปโหลด"
                            : "ยังอัปโหลดไม่ครบ")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            ข้อมูลติดต่อ
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>ข้อมูลติดต่อ</DialogTitle>
                            <DialogDescription>
                              รายละเอียดการติดต่อของ {row.fullName}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div className="flex items-start gap-3">
                              <PhoneCall className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <p className="text-sm font-medium text-foreground">เบอร์โทร</p>
                                <p className="text-sm text-muted-foreground">
                                  {row.phone && row.phone.trim().length > 0 ? row.phone : "ไม่มีข้อมูล"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <p className="text-sm font-medium text-foreground">อีเมล</p>
                                <p className="text-sm text-muted-foreground">
                                  {row.email ?? "ไม่มีข้อมูล"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <p className="text-sm font-medium text-foreground">ที่อยู่ปัจจุบัน</p>
                                <p className="text-sm text-muted-foreground truncate max-w-[280px]" title={row.currentAddress ?? "ไม่มีข้อมูล"}>
                                  {row.currentAddress ?? "ไม่มีข้อมูล"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button type="button" variant="secondary">
                                ปิดหน้าต่าง
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
                : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                      ไม่มีข้อมูลสำหรับวันที่เลือก
                    </TableCell>
                  </TableRow>
                )}
          </TableBody>
        </table>
        {/* Invisible element to trigger load more */}
        <div ref={observerTarget} className="h-4 w-full" />
      </div>
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              รายงานประจำวัน: {selectedReport ? format(parseISO(selectedReport.date), "dd MMM yyyy") : ""}
            </DialogTitle>
            <DialogDescription>
              ของ {selectedReport?.fullName} ({selectedReport?.email})
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="mt-4">
              <DailyReportView
                overrideDate={parseISO(selectedReport.date)}
                overrideEmail={selectedReport.email ?? undefined}
                className="w-full"
                onUpdate={() => {
                  if (startDate && endDate) {
                    void fetchSummary({ start: startDate, end: endDate });
                  }
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
