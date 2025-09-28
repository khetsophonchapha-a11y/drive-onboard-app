
"use client";

import { useState, useEffect } from 'react';
import type { FileRef } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Download, File as FileIcon } from 'lucide-react';
import Image from 'next/image';

type DocumentViewerProps = {
  fileRef: FileRef;
  previewUrl?: string; // Optional direct URL for preview (e.g., from object URL)
};

async function getSignedUrl(r2Key: string): Promise<string> {
  const res = await fetch('/api/r2/sign-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ r2Key }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Failed to get signed URL' }));
    throw new Error(errorBody.error);
  }
  const { url } = await res.json();
  return url;
}

export function DocumentViewer({ fileRef, previewUrl }: DocumentViewerProps) {
  const [url, setUrl] = useState<string | null>(previewUrl || null);
  const [isLoading, setIsLoading] = useState(!previewUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If a previewUrl is provided, we don't need to fetch a signed URL.
    if (previewUrl) {
      setUrl(previewUrl);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchUrl = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const signedUrl = await getSignedUrl(fileRef.r2Key);
        if (isMounted) {
          setUrl(signedUrl);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUrl();

    return () => {
      isMounted = false;
    };
  }, [fileRef.r2Key, previewUrl]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full p-2">
        <Alert variant="destructive" className="text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!url) {
    return null; // Should not happen if not loading and no error
  }
  
  const isImage = fileRef.mime.startsWith('image/');

  if (isImage) {
    return (
      <Image
        src={url}
        alt={`Preview of ${fileRef.r2Key}`}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-contain"
      />
    );
  }

  // Extract filename from r2Key for the download attribute
  const fileName = fileRef.r2Key.split('/').pop()?.split('-').slice(1).join('-') || 'document';

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-2 p-2">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
        <Button asChild size="sm">
            <a href={url} download={fileName}>
                <Download className="mr-2 h-4 w-4" />
                ดาวน์โหลดเอกสาร
            </a>
        </Button>
    </div>
  );
}

    
