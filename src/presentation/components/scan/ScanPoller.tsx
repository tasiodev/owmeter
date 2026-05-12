"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export function ScanPoller({ scanId }: { scanId: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scans/${scanId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== "RUNNING" && data.status !== "PENDING") {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        // network blip — keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanId, router]);

  return null;
}
