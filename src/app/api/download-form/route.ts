// ส่วนที่ 1: Imports และ Constants
export const runtime = 'nodejs'; // Use Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Manifest } from '@/lib/types'; // (ต้องมั่นใจว่า path นี้ถูกต้อง)

// Import aot templates จากไฟล์ที่แยกไว้
import { 
    ApplicationFormTemplate, 
    TransportContractTemplate, 
    GuaranteeContractTemplate 
} from './templates'; // (ต้องมั่นใจว่า path นี้ถูกต้อง)

// URL ของ Google Apps Script ที่ Deploy แล้ว
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz-K0rRj8ibF1aasEOo2jBPWDq765Nm5doz9LePYfzz3ZoPoqUTEXEEKJxLqVKhRHOu/exec";
// ส่วนที่ 2: ฟังก์ชันเลือก Template HTML

/**
 * เลือก React template ที่ถูกต้องตามชื่อไฟล์
 */
function getHtmlTemplate(filename: string, data: Manifest): string {
    let template;
    
    if (filename === 'application-form.pdf') {
      template = <ApplicationFormTemplate data={data} />;
    } else if (filename === 'transport-contract.pdf') {
      template = <TransportContractTemplate data={data} />;
    } else if (filename === 'guarantee-contract.pdf') {
      // ตรวจสอบว่ามีข้อมูลผู้ค้ำประกันก่อน
      if (!data.guarantor?.firstName && !data.guarantor?.lastName) {
        throw new Error('ไม่พบข้อมูลผู้ค้ำประกัน (Guarantor data is missing)');
      }
      template = <GuaranteeContractTemplate data={data} />;
    } else {
      throw new Error('Invalid filename for template selection');
    }
  
    // Render React component ใหเ้ป็น HTML string
    return renderToStaticMarkup(template);
  }
// ส่วนที่ 3: ฟังก์ชัน POST (API Endpoint หลัก)

/**
 * API Endpoint หลัก
 */
export async function POST(req: NextRequest) {
    try {
      const { filename, data } = (await req.json()) as { filename: string; data: Manifest };
  
      if (!filename || !data) {
        return NextResponse.json({ error: 'Filename and data are required' }, { status: 400 });
      }
  
      // 1. สร้าง HTML string จาก React template
      const htmlContent = getHtmlTemplate(filename, data);
  
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
      const pdfBytes = Buffer.from(result.base64, 'base64');
  
      // 4. ส่งไฟล์ PDF กลับไปให้ผู้ใช้
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  
      return new NextResponse(pdfBytes, { status: 200, headers });
  
    } catch (error) {
      console.error('[Download Form Error]', error);
      const message = error instanceof Error ? error.message : 'An internal server error occurred.';
      return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
    }
  }
    