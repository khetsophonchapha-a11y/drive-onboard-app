// src/app/api/download-form/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Manifest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
// import { th } from 'date-fns/locale'; // Removed to avoid Thai characters

function formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        // Use default English locale which is supported by Helvetica
        return format(dateObj, 'd MMMM yyyy'); 
    } catch {
        return '';
    }
}


async function fillApplicationForm(data: Manifest): Promise<Uint8Array> {
    const templatePath = path.join(process.cwd(), 'public', 'forms', 'application-form.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    
    const { applicant, applicationDetails, vehicle } = data;

    // A simple text drawing helper
    const drawText = (text: string | undefined, x: number, y: number, size = 10) => {
        // Only draw if text is defined and doesn't contain non-ASCII characters
        if (text && /^[\x00-\x7F]*$/.test(text)) {
            page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
        }
    };
    
    const drawNumeric = (num: number | undefined, x: number, y: number, size = 10) => {
        if (num !== undefined) {
             page.drawText(num.toString(), { x, y, size, font, color: rgb(0, 0, 0) });
        }
    }

    // Fill data - coordinates are examples, they need to be measured from the template
    // These fields are likely English/Numeric
    drawText(applicationDetails?.position, 450, 710);
    drawText(formatDate(applicationDetails?.applicationDate), 450, 688);
    drawText(applicant?.email, 350, 615);
    drawNumeric(applicant?.age, 250, 635);
    drawText(applicant?.nationalId, 400, 635);
    drawText(applicant?.mobilePhone, 120, 615);

    // Thai fields are skipped to prevent error
    // drawText(applicant.prefix, 100, 655);
    // drawText(applicant.firstName, 200, 655);
    // drawText(applicant.lastName, 350, 655);
    // drawText(applicant.nickname, 500, 655);
    // drawText(applicant.currentAddress?.houseNo, 150, 595);

    drawText(vehicle?.brand, 120, 450);
    drawText(vehicle?.model, 250, 450);
    drawNumeric(vehicle?.year, 400, 450);
    drawText(vehicle?.plateNo, 120, 430);
    
    // Color might be in Thai, skip for now
    // drawText(vehicle.color, 250, 430);


    return pdfDoc.save();
}

async function fillTransportContract(data: Manifest): Promise<Uint8Array> {
    const templatePath = path.join(process.cwd(), 'public', 'forms', 'transport-contract.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
     const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const { applicant, vehicle } = data;

    const drawText = (text: string | undefined, x: number, y: number, size = 10) => {
        if (text && /^[\x00-\x7F]*$/.test(text)) {
            page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
        }
    };
    
    // Example coordinates
    drawText(formatDate(data.contractDetails?.contractDate || new Date()), 450, 720);
    // Skipping fields that might contain Thai
    // drawText(applicant.fullName, 200, 650);
    // drawText(applicant.currentAddress?.houseNo, 200, 630);
    drawText(applicant?.nationalId, 400, 650);
    drawText(vehicle?.plateNo, 200, 500);


    return pdfDoc.save();
}


async function fillGuaranteeContract(data: Manifest): Promise<Uint8Array> {
    const templatePath = path.join(process.cwd(), 'public', 'forms', 'guarantee-contract.pdf');
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
     const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const { applicant, guarantor } = data;

    const drawText = (text: string | undefined, x: number, y: number, size = 10) => {
        if (text && /^[\x00-\x7F]*$/.test(text)) {
            page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
        }
    };
    
    // Example coordinates
    drawText(formatDate(guarantor?.contractDate || new Date()), 450, 750);
    // Skipping fields that are certainly Thai
    // drawText(applicant.fullName, 200, 680);
    // drawText(guarantor?.fullName, 200, 650);
    // drawText(guarantor?.address?.houseNo, 200, 630);
    drawText(guarantor?.nationalId, 400, 650);


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
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return NextResponse.json({ error: 'File template not found.' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
