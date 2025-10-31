// *** FIX: บังคับให้รันในโหมด Node.js เท่านั้น (ต้องอยู่บรรทัดแรกสุด) ***
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ApplicationFormTemplate,
  TransportContractTemplate,
  GuaranteeContractTemplate,
} from './templates'; // <-- Import จากไฟล์ templates.tsx
import type { Manifest } from '@/lib/types'; // <-- คุณต้องมีไฟล์นี้ในโปรเจกต์ของคุณ

/**
 * นี่คือ "ที่อยู่" ของโรงงาน PDF (Google Apps Script) ที่คุณ Deploy ไว้
 * (นี่คือ URL ที่คุณส่งให้ผม)
 */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz-K0rRj8ibF1aasEOo2jBPWDq765Nm5doz9LePYfzz3ZoPoqUTEXEEKJxLqVKhRHOu/exec';

/**
 * ฟังก์ชันนี้จะเลือกแม่แบบ HTML ที่ถูกต้องตามชื่อไฟล์
 * และเติมข้อมูล (data) ลงไป
 */
function getHtmlTemplate(filename: string, data: Manifest): string {
  let templateComponent;

  if (filename === 'application-form.pdf') {
    // ใช้ React component แม่แบบใบสมัคร
    templateComponent = <ApplicationFormTemplate data={data} />;
  } else if (filename === 'transport-contract.pdf') {
    // ใช้ React component แม่แบบสัญญาขนส่ง
    templateComponent = <TransportContractTemplate data={data} />;
  } else if (filename === 'guarantee-contract.pdf') {
    // ใช้ React component แม่แบบสัญญาค้ำประกัน
    templateComponent = <GuaranteeContractTemplate data={data} />;
  } else {
    // ถ้าไม่ตรงกับไฟล์ไหนเลย ให้โยน Error
    throw new Error('Invalid filename for dynamic PDF generation');
  }

  // แปลง React Component (JSX) ให้กลายเป็น String HTML (แบบ static)
  // นี่คือเหตุผลที่เราต้อง import 'react-dom/server'
  const html = renderToStaticMarkup(templateComponent);
  return html;
}

/**
 * POST Handler (Main Logic)
 * นี่คือ API Endpoint หลักที่หน้าเว็บ (Client) จะเรียกใช้
 */
export async function POST(req: NextRequest) {
  try {
    const { filename, data } = (await req.json()) as { filename: string; data: Manifest };

    if (!filename || !data) {
      return NextResponse.json({ error: 'Filename and data are required' }, { status: 400 });
    }
    
    // 1. ตรวจสอบว่ามีข้อมูลผู้ค้ำประกันหรือไม่ (ถ้าจำเป็น)
    if (filename === 'guarantee-contract.pdf' && (!data.guarantor?.firstName && !data.guarantor?.lastName)) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ค้ำประกัน' }, { status: 400 });
    }

    // 2. สร้าง String HTML จากแม่แบบ
    const htmlContent = getHtmlTemplate(filename, data);

    // 3. ส่ง HTML นี้ไปยัง "โรงงานสร้าง PDF" (Google Apps Script)
    console.log(`[API Route] Sending HTML to Google Apps Script for: ${filename}`);
    const gasResponse = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlContent, // ส่ง HTML
        filename: filename, // ส่งชื่อไฟล์
      }),
      cache: 'no-store', // ป้องกันการ cache
    });

    // 4. ตรวจสอบว่า Google Apps Script ทำงานสำเร็จหรือไม่
    if (!gasResponse.ok) {
      const errorText = await gasResponse.text();
      console.error('[GAS Error] Google Apps Script failed:', errorText);
      throw new Error(`Google Apps Script failed: ${errorText}`);
    }

    // 5. รับผลลัพธ์ (JSON ที่มี Base64 PDF) กลับมาจาก Google
    
    // *** FIX: อัปเดต Type ให้รองรับ 2 รูปแบบ (สำเร็จ หรือ ล้มเหลว) ***
    const result = (await gasResponse.json()) as 
      | { base64Pdf: string; mimeType: string; filename: string } 
      | { error: string };

    // *** FIX: ตรวจสอบ Error โดยใช้ 'in' (Type Guard) ***
    if ('error' in result) {
        throw new Error(`Google Apps Script returned an error: ${result.error}`);
    }
    
    console.log(`[API Route] Received PDF from Google Apps Script. Sending to client.`);

    // 6. แปลง Base64 (string) กลับเป็นไฟล์ (Buffer)
    //    (ณ จุดนี้ TypeScript รู้แล้วว่า 'result' ต้องเป็น { base64Pdf: ... } เท่านั้น)
    const pdfBuffer = Buffer.from(result.base64Pdf, 'base64');

    // 7. ส่งไฟล์ PDF กลับไปให้ผู้ใช้ดาวน์โหลด
    const headers = new Headers();
    headers.set('Content-Type', result.mimeType);
    headers.set('Content-Disposition', `attachment; filename="${result.filename}"`);

    return new NextResponse(pdfBuffer, { status: 200, headers });

  } catch (error) {
    console.error(`[Download Form Error] for file:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    // ส่ง Error กลับไปเป็น JSON (ป้องกัน <!DOCTYPE html> error)
    return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
  }
}

