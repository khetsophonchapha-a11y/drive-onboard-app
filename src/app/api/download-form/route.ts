// src/app/api/download-form/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Manifest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// Helper to format dates consistently with Thai locale
function formatDate(date: string | Date | undefined): string {
    if (!date) return '..............................';
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return format(dateObj, 'd MMMM yyyy', { locale: th });
    } catch {
        return '..............................';
    }
}

// Helper for optional string values
const val = (text: string | undefined | null, suffix = '') => (text ? `${text}${suffix}` : '');
const num = (n: number | undefined | null) => (n !== undefined && n !== null ? n.toString() : '');

const LINE_HEIGHT = 20;
const COL1_X = 50;
const COL2_X = 300;

async function fillApplicationForm(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const fontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'));
    const boldFontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Bold.ttf'));
    const sarabunFont = await pdfDoc.embedFont(fontBytes);
    const sarabunBoldFont = await pdfDoc.embedFont(boldFontBytes);

    let y = height - 50;

    const drawText = (text: string, x: number, currentY: number, isBold = false) => {
        page.drawText(text, { x, y: currentY, font: isBold ? sarabunBoldFont : sarabunFont, size: 12, color: rgb(0, 0, 0) });
    };

    drawText('ใบสมัครพนักงานขับรถ', width / 2 - 50, y, true);
    y -= LINE_HEIGHT * 2;

    drawText('ข้อมูลการสมัคร', COL1_X, y, true);
    y -= LINE_HEIGHT;
    drawText(`ตำแหน่งที่สมัคร: ${val(data.applicationDetails?.position)}`, COL1_X, y);
    drawText(`วันที่สมัคร: ${formatDate(data.applicationDetails?.applicationDate)}`, COL2_X, y);
    y -= LINE_HEIGHT * 1.5;

    drawText('ข้อมูลส่วนตัวผู้สมัคร', COL1_X, y, true);
    y -= LINE_HEIGHT;
    drawText(`ชื่อ-นามสกุล: ${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`, COL1_X, y);
    drawText(`เบอร์โทรศัพท์: ${val(data.applicant?.mobilePhone)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`เลขบัตรประชาชน: ${val(data.applicant?.nationalId)}`, COL1_X, y);
    drawText(`อีเมล: ${val(data.applicant?.email)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`ที่อยู่ปัจจุบัน: ${val(data.applicant?.currentAddress?.houseNo)}`, COL1_X, y);
    y -= LINE_HEIGHT * 1.5;
    
    drawText('ข้อมูลยานพาหนะ', COL1_X, y, true);
    y -= LINE_HEIGHT;
    drawText(`ยี่ห้อ/รุ่น: ${val(data.vehicle?.brand)} / ${val(data.vehicle?.model)}`, COL1_X, y);
    drawText(`ปี: ${num(data.vehicle?.year)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`ป้ายทะเบียน: ${val(data.vehicle?.plateNo)}`, COL1_X, y);
    drawText(`สี: ${val(data.vehicle?.color)}`, COL2_X, y);
    y -= LINE_HEIGHT * 1.5;

    // Signature boxes
    y -= LINE_HEIGHT * 2;
    page.drawRectangle({ x: COL2_X, y: y - 40, width: 200, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    drawText('ลงชื่อผู้สมัคร', COL2_X + 60, y - 55);
    drawText(`( ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)} )`, COL2_X + 45, y - 70);

    return pdfDoc.save();
}

async function fillTransportContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const fontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'));
    const sarabunFont = await pdfDoc.embedFont(fontBytes);

    let y = height - 50;
    
    page.drawText('สัญญาจ้างขนส่ง', { x: width / 2 - 50, y, font: sarabunFont, size: 16 });
    y -= LINE_HEIGHT * 2;
    
    page.drawText(`วันที่ทำสัญญา: ${formatDate(data.contractDetails?.contractDate || new Date())}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT * 2;

    const fullName = `${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const address = `${val(data.applicant?.currentAddress?.houseNo)}`.trim();

    page.drawText(`ผู้ว่าจ้าง: บริษัท ไดรฟ์ออนบอร์ด จำกัด`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`ผู้รับจ้าง (พนักงานขับรถ): ${fullName}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`ที่อยู่: ${address}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`เลขบัตรประชาชน: ${val(data.applicant?.nationalId)}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`ทะเบียนรถยนต์ที่ใช้ประกอบการ: ${val(data.vehicle?.plateNo)}`, { x: COL1_X, y, font: sarabunFont, size: 12 });

    return pdfDoc.save();
}


async function fillGuaranteeContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const fontBytes = await fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'));
    const sarabunFont = await pdfDoc.embedFont(fontBytes);

    let y = height - 50;

    page.drawText('สัญญาค้ำประกันการทำงาน', { x: width / 2 - 60, y, font: sarabunFont, size: 16 });
    y -= LINE_HEIGHT * 2;

    page.drawText(`วันที่ทำสัญญา: ${formatDate(data.guarantor?.contractDate || new Date())}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT * 2;
    
    const applicantFullName = `${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const guarantorFullName = `${val(data.guarantor?.firstName)} ${val(data.guarantor?.lastName)}`.trim();
    const guarantorAddress = `${val(data.guarantor?.address?.houseNo)}`.trim();

    page.drawText(`ผู้ค้ำประกัน: ${guarantorFullName}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`ที่อยู่ผู้ค้ำประกัน: ${guarantorAddress}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`เลขบัตรประชาชนผู้ค้ำประกัน: ${val(data.guarantor?.nationalId)}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT * 2;
    page.drawText(`ขอค้ำประกัน นาย/นาง/นางสาว: ${applicantFullName}`, { x: COL1_X, y, font: sarabunFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`ซึ่งเป็นพนักงานขับรถของบริษัท ไดรฟ์ออนบอร์ด จำกัด`, { x: COL1_X, y, font: sarabunFont, size: 12 });

    return pdfDoc.save();
}


export async function POST(req: NextRequest) {
  const { filename, data } = await req.json() as { filename: string, data: Manifest };

  if (!filename || !data) {
    return NextResponse.json({ error: 'Filename and data are required' }, { status: 400 });
  }

  try {
    let pdfBytes: Uint8Array;

    if (filename === 'application-form.pdf') {
        pdfBytes = await fillApplicationForm(data);
    } else if (filename === 'transport-contract.pdf') {
        pdfBytes = await fillTransportContract(data);
    } else if (filename === 'guarantee-contract.pdf') {
        if (!data.guarantor?.firstName && !data.guarantor?.lastName) {
             return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ค้ำประกัน' }, { status: 400 });
        }
        pdfBytes = await fillGuaranteeContract(data);
    } else {
         return NextResponse.json({ error: 'Invalid filename for dynamic PDF generation' }, { status: 400 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(pdfBytes, { status: 200, headers });

  } catch (error) {
    console.error(`[Download Form Error] for file ${filename}:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
