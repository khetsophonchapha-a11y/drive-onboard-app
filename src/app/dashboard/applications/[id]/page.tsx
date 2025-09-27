"use client";

import { useEffect, useState } from "react";
import { ApplicationDetails } from "@/components/dashboard/application-details";
import type { Application } from "@/lib/types";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

type PageProps = {
  params: {
    id: string;
  };
};

export default function ApplicationDetailPage({ params }: PageProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    const fetchApplication = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/applications/${params.id}`);
        if (res.status === 404) {
          notFound();
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch application details");
        }
        const data = await res.json();
        setApplication(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplication();
  }, [params.id]);


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
