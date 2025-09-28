
"use client";

import { useState, useEffect } from 'react';
import type { FileRef } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, File as FileIcon } from 'lucide-react';
import Image from 'next/image';

type DocumentViewerProps = {
  fileRef: FileRef;
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

export function DocumentViewer({ fileRef }: DocumentViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [fileRef.r2Key]);

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

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-2 p-2">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-center text-muted-foreground">ไม่สามารถแสดงตัวอย่างได้</p>
        <Button asChild size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                เปิดเอกสาร
            </a>
        </Button>
    </div>
  );
}
