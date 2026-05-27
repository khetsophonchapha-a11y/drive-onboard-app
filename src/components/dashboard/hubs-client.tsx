"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubForm } from "./hub-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Hub } from "@/lib/d1-hubs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";

export function HubsClient({ initialData }: { initialData: Hub[] }) {
  const [hubs, setHubs] = useState<Hub[]>(initialData);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const handleCreate = async (values: { name: string }) => {
    setIsPending(true);
    try {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create Hub");

      setHubs((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setIsCreateOpen(false);
      toast({ title: "สำเร็จ", description: "เพิ่ม Hub เรียบร้อยแล้ว" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleEdit = async (values: { name: string }) => {
    if (!selectedHub) return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/hubs/${selectedHub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Hub");

      setHubs((prev) =>
        prev.map((h) => (h.id === data.id ? data : h)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setIsEditOpen(false);
      setSelectedHub(null);
      toast({ title: "สำเร็จ", description: "แก้ไข Hub เรียบร้อยแล้ว" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/hubs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete Hub");

      setHubs((prev) => prev.filter((h) => h.id !== id));
      toast({ title: "สำเร็จ", description: "ลบ Hub เรียบร้อยแล้ว" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const openEdit = (hub: Hub) => {
    setSelectedHub(hub);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่ม Hub ใหม่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่ม Hub ใหม่</DialogTitle>
            </DialogHeader>
            <HubForm onSubmit={handleCreate} isPending={isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ Hub</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hubs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <MapPin className="h-8 w-8 text-muted-foreground/50" />
                    <p>ยังไม่มีข้อมูล Hub</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              hubs.map((hub) => (
                <TableRow key={hub.id}>
                  <TableCell className="font-medium">{hub.name}</TableCell>
                  <TableCell>
                    {hub.createdAt ? format(parseISO(hub.createdAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(hub)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>ยืนยันการลบ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            คุณแน่ใจหรือไม่ที่จะลบ Hub "{hub.name}"? การกระทำนี้ไม่สามารถย้อนกลับได้
                            และจะไม่สามารถลบได้หากมีพนักงานอยู่ใน Hub นี้
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(hub.id)} className="bg-destructive hover:bg-destructive/90">
                            ลบข้อมูล
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไข Hub</DialogTitle>
          </DialogHeader>
          {selectedHub && (
            <HubForm
              initialName={selectedHub.name}
              onSubmit={handleEdit}
              isPending={isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
