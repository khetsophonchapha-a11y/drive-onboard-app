"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const RELOAD_GUARD_KEY = "dashboard-error-auto-reload";

function shouldReloadForChunkError(error: Error) {
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    message.includes("chunk") ||
    message.includes("loading css chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed")
  );
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const canAutoReload = useMemo(() => shouldReloadForChunkError(error), [error]);

  useEffect(() => {
    console.error("[DashboardError]", error);

    if (!canAutoReload || typeof window === "undefined") {
      return;
    }

    const hasReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
    if (hasReloaded) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return;
    }

    sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    window.location.reload();
  }, [canAutoReload, error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">หน้าแดชบอร์ดโหลดไม่สำเร็จ</h1>
            <p className="text-sm text-muted-foreground">
              ระบบพยายามกู้คืนให้อัตโนมัติแล้ว หากยังไม่หายให้รีโหลดอีกครั้งเพื่อดึงไฟล์หน้าเว็บเวอร์ชันล่าสุด
            </p>
            <p className="break-words text-xs text-muted-foreground">
              {error.message || "Unknown client-side error"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            ลองโหลดใหม่
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem(RELOAD_GUARD_KEY);
                window.location.reload();
              }
            }}
          >
            รีโหลดทั้งหน้า
          </Button>
        </div>
      </div>
    </div>
  );
}
