"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Hub } from "@/lib/d1-hubs";
import { Loader2 } from "lucide-react";

interface HubSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (hubId?: string) => void;
  title?: string;
  description?: string;
  isPending?: boolean;
  initialHubId?: string | null;
}

export function HubSelectModal({
  isOpen,
  onClose,
  onConfirm,
  title = "เลือก Hub สังกัด",
  description = "กรุณาเลือก Hub ให้กับพนักงานท่านนี้ สามารถเลือกไว้ทีหลังได้",
  isPending = false,
  initialHubId,
}: HubSelectModalProps) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>("none");

  useEffect(() => {
    if (isOpen) {
      setSelectedHubId(initialHubId || "none");
    }
  }, [isOpen, initialHubId]);

  useEffect(() => {
    if (isOpen && hubs.length === 0) {
      fetch("/api/hubs")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setHubs(data);
        })
        .catch((err) => console.error("Failed to fetch hubs:", err));
    }
  }, [isOpen, hubs.length]);

  const handleConfirm = () => {
    onConfirm(selectedHubId === "none" ? undefined : selectedHubId);
  };

  const handleLater = () => {
    onConfirm(undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select
            value={selectedHubId}
            onValueChange={setSelectedHubId}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="เลือก Hub..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ไม่มี Hub</SelectItem>
              {hubs.map((hub) => (
                <SelectItem key={hub.id} value={hub.id}>
                  {hub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleLater}
            disabled={isPending}
          >
            ไว้ทีหลัง
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ยืนยัน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
