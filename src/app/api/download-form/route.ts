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
        // Revert to non-Thai locale temporarily to avoid font issues if no custom font is loaded
        return format(dateObj, 'd MMMM yyyy'); 
    } catch {
        return '..............................';
    }
}

// Helper for optional string values
const val = (text: string | undefined | null, suffix = '') => {
    if (!text) return '';
    // Basic check for non-ASCII characters.
    // In a real scenario without a proper Thai font, we might return a placeholder.
    // For now, we'll allow it and let pdf-lib handle it (which might error or show garbage).
    // This approach is chosen to get the system working without file dependencies.
    return `${text}${suffix}`;
};

const num = (n: number | undefined | null) => (n !== undefined && n !== null ? n.toString() : '');

const LINE_HEIGHT = 20;
const COL1_X = 50;
const COL2_X = 300;

async function fillApplicationForm(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // Use a standard font as we cannot rely on file system access for custom fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    const drawText = (text: string, x: number, currentY: number, isBold = false) => {
        try {
            page.drawText(text, { x, y: currentY, font: isBold ? helveticaBoldFont : helveticaFont, size: 12, color: rgb(0, 0, 0) });
        } catch (e) {
            // If encoding fails, draw a placeholder. This is a fallback.
            page.drawText('[unsupported-char]', { x, y: currentY, font: helveticaFont, size: 10, color: rgb(1, 0, 0) });
        }
    };

    drawText('Driver Application Form', width / 2 - 70, y, true);
    y -= LINE_HEIGHT * 2;

    drawText('Application Information', COL1_X, y, true);
    y -= LINE_HEIGHT;
    drawText(`Position: ${val(data.applicationDetails?.position)}`, COL1_X, y);
    drawText(`Application Date: ${formatDate(data.applicationDetails?.applicationDate)}`, COL2_X, y);
    y -= LINE_HEIGHT * 1.5;

    drawText('Applicant Information', COL1_X, y, true);
    y -= LINE_HEIGHT;
    // Attempt to draw Thai text. pdf-lib with standard fonts might fail.
    const applicantName = `${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`;
    drawText(`Name: ${applicantName}`, COL1_X, y);
    drawText(`Phone: ${val(data.applicant?.mobilePhone)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`National ID: ${val(data.applicant?.nationalId)}`, COL1_X, y);
    drawText(`Email: ${val(data.applicant?.email)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`Current Address: ${val(data.applicant?.currentAddress?.houseNo)}`, COL1_X, y);
    y -= LINE_HEIGHT * 1.5;
    
    drawText('Vehicle Information', COL1_X, y, true);
    y -= LINE_HEIGHT;
    drawText(`Brand/Model: ${val(data.vehicle?.brand)} / ${val(data.vehicle?.model)}`, COL1_X, y);
    drawText(`Year: ${num(data.vehicle?.year)}`, COL2_X, y);
    y -= LINE_HEIGHT;
    drawText(`Plate No: ${val(data.vehicle?.plateNo)}`, COL1_X, y);
    drawText(`Color: ${val(data.vehicle?.color)}`, COL2_X, y);
    y -= LINE_HEIGHT * 1.5;

    // Signature boxes
    y -= LINE_HEIGHT * 2;
    page.drawRectangle({ x: COL2_X, y: y - 40, width: 200, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    drawText('Applicant Signature', COL2_X + 50, y - 55);
    drawText(`( ${applicantName} )`, COL2_X + 45, y - 70);

    return pdfDoc.save();
}

async function fillTransportContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;
    
    page.drawText('Transport Contract', { x: width / 2 - 50, y, font: helveticaFont, size: 16 });
    y -= LINE_HEIGHT * 2;
    
    page.drawText(`Contract Date: ${formatDate(data.contractDetails?.contractDate || new Date())}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT * 2;

    const fullName = `${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const address = `${val(data.applicant?.currentAddress?.houseNo)}`.trim();

    page.drawText(`Employer: DriveOnboard Co., Ltd.`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`Employee (Driver): ${fullName}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`Address: ${address}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`National ID: ${val(data.applicant?.nationalId)}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`Vehicle Used: ${val(data.vehicle?.plateNo)}`, { x: COL1_X, y, font: helveticaFont, size: 12 });

    return pdfDoc.save();
}


async function fillGuaranteeContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;

    page.drawText('Work Guarantee Contract', { x: width / 2 - 60, y, font: helveticaFont, size: 16 });
    y -= LINE_HEIGHT * 2;

    page.drawText(`Contract Date: ${formatDate(data.guarantor?.contractDate || new Date())}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT * 2;
    
    const applicantFullName = `${val(data.applicant?.prefix)} ${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const guarantorFullName = `${val(data.guarantor?.firstName)} ${val(data.guarantor?.lastName)}`.trim();
    const guarantorAddress = `${val(data.guarantor?.address?.houseNo)}`.trim();

    page.drawText(`Guarantor: ${guarantorFullName}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`Guarantor Address: ${guarantorAddress}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`Guarantor National ID: ${val(data.guarantor?.nationalId)}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT * 2;
    page.drawText(`Hereby guarantees: ${applicantFullName}`, { x: COL1_X, y, font: helveticaFont, size: 12 });
    y -= LINE_HEIGHT;
    page.drawText(`who is an employee of DriveOnboard Co., Ltd.`, { x: COL1_X, y, font: helveticaFont, size: 12 });

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
    // This is the error that gets thrown back to the client
    return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
  }
}
