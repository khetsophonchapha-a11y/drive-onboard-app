"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { ApplicationDetails } from "@/components/dashboard/application-details";
import type { Manifest } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [application, setApplication] = useState<Manifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchApplication = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/applications/${id}`);
        if (res.status === 404) {
          notFound();
          return;
        }
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Failed to fetch application details' }));
          throw new Error(errorData.error);
        }
        const data: Manifest = await res.json();
        setApplication(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [id]);


  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive-foreground bg-destructive p-4 rounded-md">Error: {error}</div>;
  }
  
  if (!application) {
     notFound();
  }


  return (
    <div className="space-y-6">
      <ApplicationDetails application={application} />
    </div>
  );
}
