
"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { PlusCircle, Calendar as CalendarIcon, X, Trash2, MoreHorizontal, Eye, Check, XCircle as XCircleIcon } from "lucide-react"
import Link from "next/link"
import { DateRange } from "react-day-picker"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge";
import type { AppRow, VerificationStatus } from "@/lib/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";


type BadgeVariant = "default" | "secondary" | "success" | "destructive" | "outline";
const statusVariantMap: Record<VerificationStatus, BadgeVariant> = {
  pending: "default",
  approved: "success",
  rejected: "destructive",
  terminated: "secondary",
};

const statusText: Record<VerificationStatus, string> = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
  terminated: "เลิกจ้าง",
};

type ApplicationsTableProps = {
  applications: AppRow[];
  onDelete: (applicationId: string) => void;
};

export function ApplicationsTable({ applications, onDelete }: ApplicationsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{"id": "createdAt", "desc": true}]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [date, setDate] = React.useState<DateRange | undefined>()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [applicationToDelete, setApplicationToDelete] = React.useState<AppRow | null>(null);
  const { toast } = useToast();

  const handleOpenDeleteDialog = (application: AppRow) => {
    setApplicationToDelete(application);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (applicationToDelete) {
      onDelete(applicationToDelete.appId);
      toast({
        title: "ลบใบสมัครสำเร็จ (จำลอง)",
        description: `ใบสมัครของ ${applicationToDelete.fullName} ได้ถูกลบออกจาก UI แล้ว`,
      });
      setIsDeleteDialogOpen(false);
      setApplicationToDelete(null);
    }
  };

  const columns: ColumnDef<AppRow>[] = [
    {
        accessorKey: "fullName",
        header: "ผู้สมัคร",
        cell: ({ row }) => <div>{row.getValue("fullName")}</div>,
    },
    {
        accessorKey: "status",
        header: "สถานะ",
        cell: ({ row }) => {
            const status = row.getValue("status") as VerificationStatus;
            return <Badge variant={statusVariantMap[status]}>{statusText[status]}</Badge>;
        },
    },
    {
        accessorKey: "createdAt",
        header: "วันที่ส่ง",
        cell: ({ row }) => {
            return <div>{format(new Date(row.getValue("createdAt")), "PPP", { locale: th })}</div>;
        },
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const application = row.original;
            return (
                <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/applications/${application.appId}`}>
                            <Eye className="mr-1 h-4 w-4" /> ดูข้อมูล
                        </Link>
                    </Button>
                    <Button variant="success" size="sm" onClick={() => console.log('Approve', application.appId)}>
                        <Check className="mr-1 h-4 w-4" /> อนุมัติ
                    </Button>
                     <Button variant="destructive" size="sm" onClick={() => console.log('Reject', application.appId)}>
                        <XCircleIcon className="mr-1 h-4 w-4" /> ปฏิเสธ
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">เปิดเมนู</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions เพิ่มเติม</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleOpenDeleteDialog(application)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>ลบใบสมัคร</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            );
        },
    },
  ];


  const table = useReactTable({
    data: applications,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  React.useEffect(() => {
    if (date?.from) {
      // If only `from` is selected, filter from that day to now.
      // If `to` is also selected, filter between `from` and `to`.
      const toDate = date.to ? date.to : new Date();
      table.getColumn('createdAt')?.setFilterValue([date.from, toDate]);
    } else {
        table.getColumn('createdAt')?.setFilterValue(undefined);
    }
  }, [date, table]);


  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-2">
        <Input
          placeholder="ค้นหาชื่อผู้สมัคร..."
          value={(table.getColumn("fullName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("fullName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="relative">
          <Popover>
              <PopoverTrigger asChild>
                  <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                  )}
                  >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                      date.to ? (
                      <>
                          {format(date.from, "LLL dd, y", { locale: th })} -{" "}
                          {format(date.to, "LLL dd, y", { locale: th })}
                      </>
                      ) : (
                      format(date.from, "LLL dd, y", { locale: th })
                      )
                  ) : (
                      <span>เลือกช่วงวันที่</span>
                  )}
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                  locale={th}
                  />
              </PopoverContent>
          </Popover>
          {date && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setDate(undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button asChild className="ml-auto">
          <Link href="/apply">
            <PlusCircle className="mr-2 h-4 w-4" />
            สร้างใบสมัครใหม่
          </Link>
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ก่อนหน้า
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            ถัดไป
          </Button>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบใบสมัคร</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบใบสมัครของ{" "}
              <span className="font-semibold">{applicationToDelete?.fullName}</span>? 
              การกระทำนี้ไม่สามารถย้อนกลับได้ (ในตอนนี้จะเป็นการลบจากหน้าจอเท่านั้น)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
