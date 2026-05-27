"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { Undo2, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { hardDeleteApplication, restoreApplication } from "@/app/actions";
import type { AppRow, VerificationStatus } from "@/lib/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

type DeletedAppRow = AppRow & { deletedAt: string };

type TrashClientProps = {
  deletedApplications: DeletedAppRow[];
  currentUserRole?: string;
};

const statusText: Record<VerificationStatus, string> = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
  terminated: "เลิกจ้าง",
};

type BadgeVariant = "default" | "secondary" | "success" | "destructive" | "outline";
const statusVariantMap: Record<VerificationStatus, BadgeVariant> = {
  pending: "default",
  approved: "success",
  rejected: "destructive",
  terminated: "secondary",
};

export function TrashClient({ deletedApplications, currentUserRole }: TrashClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const canHardDelete = currentUserRole === "god";
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "deletedAt", desc: true }]);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = React.useState(false);
  const [isHardDeleteDialogOpen, setIsHardDeleteDialogOpen] = React.useState(false);
  const [selectedApp, setSelectedApp] = React.useState<DeletedAppRow | null>(null);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [isHardDeleting, setIsHardDeleting] = React.useState(false);

  const handleOpenRestoreDialog = (app: DeletedAppRow) => {
    setSelectedApp(app);
    setIsRestoreDialogOpen(true);
  };

  const handleOpenHardDeleteDialog = (app: DeletedAppRow) => {
    setSelectedApp(app);
    setIsHardDeleteDialogOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedApp) return;
    setIsRestoring(true);

    const result = await restoreApplication(selectedApp.appId);

    if (result.success) {
      toast({
        title: "กู้คืนใบสมัครสำเร็จ",
        description: `ใบสมัครของ ${selectedApp.fullName} ถูกกู้คืนเรียบร้อยแล้ว`,
      });
      router.refresh();
    } else {
      toast({
        title: "กู้คืนไม่สำเร็จ",
        description: result.error,
        variant: "destructive",
      });
    }

    setIsRestoring(false);
    setIsRestoreDialogOpen(false);
    setSelectedApp(null);
  };

  const handleHardDeleteConfirm = async () => {
    if (!selectedApp) return;
    setIsHardDeleting(true);

    const result = await hardDeleteApplication(selectedApp.appId);

    if (result.success) {
      toast({
        title: "ลบถาวรสำเร็จ",
        description: `ใบสมัครของ ${selectedApp.fullName} ถูกลบออกจากระบบถาวรแล้ว`,
      });
      router.refresh();
    } else {
      toast({
        title: "ลบถาวรไม่สำเร็จ",
        description: result.error,
        variant: "destructive",
      });
    }

    setIsHardDeleting(false);
    setIsHardDeleteDialogOpen(false);
    setSelectedApp(null);
  };

  const columns: ColumnDef<DeletedAppRow>[] = [
    {
      accessorKey: "fullName",
      header: "ผู้สมัคร",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("fullName")}</div>
      ),
    },
    {
      accessorKey: "status",
      header: "สถานะก่อนลบ",
      cell: ({ row }) => {
        const status = row.getValue("status") as VerificationStatus;
        return <Badge variant={statusVariantMap[status]}>{statusText[status]}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "วันที่ส่ง",
      cell: ({ row }) => {
        try {
          return (
            <div className="text-muted-foreground">
              {format(new Date(row.getValue("createdAt")), "PPP", { locale: th })}
            </div>
          );
        } catch {
          return <div className="text-muted-foreground">-</div>;
        }
      },
    },
    {
      accessorKey: "deletedAt",
      header: "วันที่ลบ",
      cell: ({ row }) => {
        try {
          return (
            <div className="text-destructive font-medium">
              {format(new Date(row.getValue("deletedAt")), "PPP p", { locale: th })}
            </div>
          );
        } catch {
          return <div className="text-muted-foreground">-</div>;
        }
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const app = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRestoreDialog(app)}
              className="text-success border-success/30 hover:bg-success/10 hover:text-success"
            >
              <Undo2 className="mr-1 h-4 w-4" />
              กู้คืน
            </Button>
            {canHardDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleOpenHardDeleteDialog(app)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                ลบถาวร
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: deletedApplications,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="w-full space-y-4">
      {deletedApplications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">ถังขยะว่าง</h3>
          <p className="text-sm text-muted-foreground mt-1">
            ไม่มีใบสมัครที่ถูกลบ
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              พบ <span className="font-semibold">{deletedApplications.length}</span> ใบสมัครในถังขยะ
              — คลิก &quot;กู้คืน&quot; เพื่อนำกลับมาแสดงในรายการหลัก
              {canHardDelete ? " หรือกด \"ลบถาวร\" เพื่อลบออกจากระบบแบบย้อนกลับไม่ได้" : ""}
            </p>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="bg-destructive/5 hover:bg-destructive/10">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              แสดง {table.getRowModel().rows.length} จาก {deletedApplications.length} รายการ
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
        </>
      )}

      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการกู้คืนใบสมัคร</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการกู้คืนใบสมัครของ{" "}
              <span className="font-semibold">{selectedApp?.fullName}</span> หรือไม่?
              ใบสมัครจะถูกนำกลับมาแสดงในรายการหลัก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              {isRestoring ? "กำลังกู้คืน..." : "ยืนยันกู้คืน"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isHardDeleteDialogOpen} onOpenChange={setIsHardDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบถาวร</AlertDialogTitle>
            <AlertDialogDescription>
              ใบสมัครของ{" "}
              <span className="font-semibold">{selectedApp?.fullName}</span>{" "}
              จะถูกลบออกจากฐานข้อมูลถาวร รวมถึงข้อมูลเอกสารที่ผูกกับใบสมัครนี้ และไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isHardDeleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDeleteConfirm}
              disabled={isHardDeleting}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {isHardDeleting ? "กำลังลบถาวร..." : "ยืนยันลบถาวร"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
