"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, UploadCloud, MoreHorizontal, Eye, Download, Camera } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DailyReportResponseSlot } from "@/lib/daily-report";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface DailyReportSlotCardProps {
  slot: DailyReportResponseSlot;
  uploading: boolean;
  deleting: boolean;
  descriptionSaving?: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onDescriptionSave?: (description: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  showDescriptionField?: boolean;
}

export function DailyReportSlotCard({
  slot,
  uploading,
  deleting,
  descriptionSaving = false,
  onUpload,
  onDelete,
  onDescriptionSave,
  disabled,
  disabledReason,
  showDescriptionField = false,
}: DailyReportSlotCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(slot.description ?? "");

  useEffect(() => {
    setDescription(slot.description ?? "");
  }, [slot.description, slot.id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleFilePickerClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const isBusy = uploading || deleting || descriptionSaving;
  const descriptionDirty = description.trim() !== (slot.description ?? "").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{slot.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          {slot.url ? (
            <>
              <img
                src={slot.url}
                alt={slot.label}
                className="aspect-video w-full rounded-md object-cover"
              />
              {!disabled && (
                <div className="absolute top-2 right-2">
                  {deleting ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background/80">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 hover:bg-background/90" disabled={isBusy}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(slot.url, '_blank')}>
                          <Eye className="mr-2 h-4 w-4" />
                          <span>View</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={slot.url} download={slot.fileName} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/40">
              {disabled ? (
                <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
              ) : (
                <p className="text-sm text-muted-foreground">No image uploaded</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="truncate pr-2">{slot.fileName || "ยังไม่มีไฟล์"}</span>
          <span>{slot.uploadedAt ? format(new Date(slot.uploadedAt), "PPp") : "-"}</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isBusy || disabled}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={isBusy || disabled}
        />
        {!disabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleFilePickerClick}
              disabled={isBusy}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {slot.url ? "เปลี่ยนจากไฟล์" : "อัปโหลดจากไฟล์"}
            </Button>
            <Button
              type="button"
              className="w-full"
              onClick={handleCameraClick}
              disabled={isBusy}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {slot.url ? "ถ่ายรูปใหม่" : "ถ่ายรูป"}
            </Button>
          </div>
        )}
        {showDescriptionField && (
          <div className="space-y-2">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={disabled || !slot.url || isBusy}
              placeholder={slot.url ? "รายละเอียดเพิ่มเติม (ไม่บังคับ)" : "อัปโหลดรูปก่อนแล้วจึงเพิ่มรายละเอียด"}
              rows={3}
            />
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onDescriptionSave?.(description.trim())}
                disabled={!slot.url || isBusy || !descriptionDirty}
              >
                {descriptionSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                บันทึกคำอธิบาย
              </Button>
            )}
          </div>
        )}
        {disabled && disabledReason && !slot.url && (
          <p className="text-xs text-center text-destructive">{disabledReason}</p>
        )}
      </CardContent>
    </Card>
  );
}

DailyReportSlotCard.Skeleton = function DailyReportSlotCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-2/4" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
};
