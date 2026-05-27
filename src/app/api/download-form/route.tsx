// src/app/api/download-form/route.tsx
 // Use Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import type { Manifest } from '@/lib/types';
import { resolvePublicOrigin } from "@/lib/public-url";
import { getR2Binding } from "@/lib/r2/binding";

// Import aot templates 
import {
  ApplicationFormTemplate,
  TransportContractTemplate,
  GuaranteeContractTemplate
} from './templates';

export const runtime = 'nodejs';

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz-K0rRj8ibF1aasEOo2jBPWDq765Nm5doz9LePYfzz3ZoPoqUTEXEEKJxLqVKhRHOu/exec";

type TemplateAssets = {
  logoDataUrl: string | null;
  regularFontDataUrl: string | null;
  boldFontDataUrl: string | null;
};

function getFallbackMimeType(assetPath: string) {
  if (assetPath.endsWith('.png')) return 'image/png';
  if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) return 'image/jpeg';
  if (assetPath.endsWith('.webp')) return 'image/webp';
  if (assetPath.endsWith('.ttf')) return 'font/ttf';
  if (assetPath.endsWith('.otf')) return 'font/otf';
  return 'application/octet-stream';
}

async function fetchPublicAssetAsDataUrl(req: NextRequest, assetPath: string): Promise<string | null> {
  try {
    const assetUrl = new URL(assetPath, resolvePublicOrigin(req) ?? req.nextUrl.origin);
    const response = await fetch(assetUrl.toString(), {
      headers: {
        'x-pdf-asset-request': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Asset request failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || getFallbackMimeType(assetPath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error(`Failed to fetch public asset ${assetPath}:`, error);
    return null;
  }
}

// Helper: Fetch image from R2 and convert to Base64
async function fetchImageBase64(r2Key: string): Promise<string | null> {
  try {
    // 1. Local Fallback using AWS SDK
    if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_APP_URL) {
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const endpoint = process.env.R2_ENDPOINT;
      const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;

      if (accessKeyId && secretAccessKey && endpoint && bucketName) {
        const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = new S3Client({
            region: "auto",
            endpoint: endpoint,
            credentials: { accessKeyId, secretAccessKey },
        });

        try {
            const response = await s3.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: r2Key,
            }));
            
            if (response.Body) {
                const chunks = [];
                for await (const chunk of response.Body as any) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                const mimeType = response.ContentType || 'image/png';
                return `data:${mimeType};base64,${base64}`;
            }
        } catch (e: any) {
            console.warn(`S3 fallback failed to get key ${r2Key}:`, e.message);
        }
      }
    }

    // 2. Production / Remote using R2 Binding
    const bucket = await getR2Binding();
    if (!bucket) return null;
    
    const object = await bucket.get(r2Key);
    if (!object) return null;

    const arrayBuffer = await object.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = object.httpMetadata?.contentType || 'image/png';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Failed to fetch image for key ${r2Key}:`, error);
    return null;
  }
}

async function loadTemplateAssets(req: NextRequest): Promise<TemplateAssets> {
  const [logoDataUrl, regularFontDataUrl, boldFontDataUrl] = await Promise.all([
    fetchPublicAssetAsDataUrl(req, '/images/boekfah-logo.png'),
    fetchPublicAssetAsDataUrl(req, '/fonts/Sarabun-Regular.ttf'),
    fetchPublicAssetAsDataUrl(req, '/fonts/Sarabun-Bold.ttf'),
  ]);

  return {
    logoDataUrl,
    regularFontDataUrl,
    boldFontDataUrl,
  };
}

async function getHtmlTemplate(
  filename: string,
  data: Manifest,
  assets: TemplateAssets,
  signatures?: { applicant?: string | null, guarantor?: string | null }
): Promise<string> {
  let template;

  // Inject signatures into data 
  const dataWithSignatures = {
    ...data,
    signatures,
    pdfAssets: assets,
  };

  if (filename.includes('application-form') || filename.includes('ใบสมัครงาน')) {
    template = <ApplicationFormTemplate data={dataWithSignatures} />;
  } else if (filename.includes('transport-contract') || filename.includes('สัญญาจ้าง')) {
    template = <TransportContractTemplate data={dataWithSignatures} />;
  } else if (filename.includes('guarantee-contract') || filename.includes('สัญญาค้ำประกัน')) {
    if (!data.guarantor?.firstName && !data.guarantor?.lastName) {
      throw new Error('ไม่พบข้อมูลผู้ค้ำประกัน (Guarantor data is missing)');
    }
    template = <GuaranteeContractTemplate data={dataWithSignatures} />;
  } else {
    throw new Error('Invalid filename for template selection');
  }

  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(template);
}

export async function POST(req: NextRequest) {
  try {
    const { filename, data } = (await req.json()) as { filename: string; data: Manifest };

    if (!filename || !data) {
      return NextResponse.json({ error: 'Filename and data are required' }, { status: 400 });
    }

    // Fetch signatures if they exist in R2
    let applicantSigBase64: string | null = null;
    let guarantorSigBase64: string | null = null;

    if (data.docs?.signature?.r2Key) {
      applicantSigBase64 = await fetchImageBase64(data.docs.signature.r2Key);
    }

    if (data.docs?.guarantorSignature?.r2Key) {
      guarantorSigBase64 = await fetchImageBase64(data.docs.guarantorSignature.r2Key);
    }

    const assets = await loadTemplateAssets(req);

    // 1. สร้าง HTML string จาก React template พร้อมลายเซ็น
    const htmlContent = await getHtmlTemplate(filename, data, assets, {
      applicant: applicantSigBase64,
      guarantor: guarantorSigBase64
    });

    // 2. ส่ง HTML ไปให้ Google Apps Script เพื่อแปลง
    const gasResponse = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: htmlContent,
        filename: filename
      }),
      // เพิ่ม timeout (เช่น 30 วินาที)
      signal: AbortSignal.timeout(30000),
    });

    if (!gasResponse.ok) {
      const errorText = await gasResponse.text();
      throw new Error(`Google Apps Script failed: ${gasResponse.status} ${errorText}`);
    }

    const result = await gasResponse.json();
    if (result.error) {
      throw new Error(`Google Apps Script Error: ${result.error}`);
    }

    // 3. ถอดรหัส Base64 PDF ที่ได้กลับมา
    // note: GAS might return 'base64' (clean) or 'base64Pdf' (legacy) depending on implementation version. 
    // Checking previous 'HEAD' it used 'base64Pdf'. Checking 'Incoming' it used 'base64'. 
    // Let's safe check both or trust Incoming code structure. Incoming uses 'result.base64'.
    const pdfBytes = Buffer.from(result.base64 || result.base64Pdf, 'base64');

    // 4. ส่งไฟล์ PDF กลับไปให้ผู้ใช้
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

    return new NextResponse(pdfBytes, { status: 200, headers });

  } catch (error) {
    console.error('[Download Form Error]', error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
  }
}
