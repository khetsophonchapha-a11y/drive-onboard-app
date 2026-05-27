"use client";

import { useState, useTransition } from "react";
import type { User } from "@/lib/types";
import { UsersTable } from "./users-table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import type { Hub } from "@/lib/d1-hubs";
import { HubSelectModal } from "./hub-select-modal";
import { updateDriverHub } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserForm } from "./user-form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import * as z from "zod";

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
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";


// This can be inferred from the form schema in UserForm, but defining it here is fine too.
const formSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "employee"]),
  phone: z.string().optional(),
  password: z.string().min(6),
});


interface UsersClientProps {
  data: User[];
  hubs?: Hub[];
  currentUserEmail?: string;
  currentUserRole?: string;
}

export function UsersClient({ data, hubs = [], currentUserEmail, currentUserRole }: UsersClientProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditHubModalOpen, setIsEditHubModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const getHubName = (hubId?: string | null) => {
    if (!hubId) return "ไม่มี Hub";
    const hub = hubs.find((h) => h.id === hubId);
    return hub ? hub.name : "ไม่ทราบ Hub";
  };

  const handleEditHubClick = (user: User) => {
    setEditingUser(user);
    setIsEditHubModalOpen(true);
  };

  const handleEditHubConfirm = async (hubId?: string) => {
    if (!editingUser) return;
    startTransition(async () => {
      const result = await updateDriverHub(editingUser.email, hubId || null);
      if (result.success) {
        toast({ title: 'อัปเดต Hub สำเร็จ' });
        router.refresh();
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: result.error, variant: 'destructive' });
      }
      setIsEditHubModalOpen(false);
      setEditingUser(null);
    });
  };

  const handleCreateUser = async (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          throw new Error('Failed to create user');
        }

        toast({
          title: "สำเร็จ",
          description: "สมาชิกใหม่ถูกสร้างขึ้นเรียบร้อยแล้ว",
        });
        setIsCreateDialogOpen(false);
        router.refresh();
      } catch (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถสร้างสมาชิกใหม่ได้",
          variant: "destructive",
        });
      }
    });
  };



  const handleOpenDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete user');
        }

        toast({
          title: "สำเร็จ",
          description: "สมาชิกถูกลบเรียบร้อยแล้ว",
        });
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
        router.refresh();
      } catch (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถลบสมาชิกได้",
          variant: "destructive",
        });
      }
    });
  };
  


  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">จัดการสมาชิก</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              เพิ่มสมาชิกใหม่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มสมาชิกใหม่</DialogTitle>
            </DialogHeader>
            <UserForm onSubmit={handleCreateUser} isPending={isPending} />
          </DialogContent>
        </Dialog>
      </div>
      <UsersTable 
        data={data} 
        onDelete={handleOpenDeleteDialog}
        onEditHub={handleEditHubClick}
        getHubName={getHubName} 
      />



      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้{" "}
              <span className="font-semibold">{selectedUser?.name}</span>?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className={cn(buttonVariants({ variant: "destructive" }))}
              disabled={isPending}
            >
              {isPending ? "กำลังลบ..." : "ลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HubSelectModal
        isOpen={isEditHubModalOpen}
        onClose={() => setIsEditHubModalOpen(false)}
        onConfirm={handleEditHubConfirm}
        isPending={isPending}
      />
    </>
  );
}
