
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import type { Manifest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// --- HELPER FUNCTIONS ---

const LINE_HEIGHT = 18;
const FONT_SIZE = 10;
const FONT_SIZE_SMALL = 8;
const PAGE_MARGIN = 50;

/**
 * โหลดฟอนต์ (Fallback to Helvetica)
 * @param pdfDoc เอกสาร PDF ที่จะฝังฟอนต์
 * @returns อ็อบเจกต์ที่มีฟอนต์
 */
async function loadFonts(pdfDoc: PDFDocument) {
    // Fallback to Helvetica as we cannot reliably load custom fonts in this environment.
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    // isThaiFontLoaded is always false because Helvetica doesn't support Thai.
    const isThaiFontLoaded = false; 

    return { font, boldFont, isThaiFontLoaded };
}

/**
 * จัดรูปแบบวันที่
 * @param date วันที่ (string หรือ Date)
 * @param useThaiLocale ถ้าเป็น true จะใช้ Locale ไทย
 * @returns string วันที่ที่จัดรูปแบบแล้ว
 */
function formatDate(date: string | Date | undefined, useThaiLocale = false): string {
    if (!date) return '..............................';
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
         // Always use non-Thai format for Helvetica
        const locale = useThaiLocale ? { locale: th } : {};
        if (useThaiLocale) {
             return format(dateObj, 'd MMMM yyyy', locale);
        }
        return format(dateObj, 'dd / MM / yyyy');
    } catch {
        return '..............................';
    }
}

/**
 * ดึงค่า string หรือ '' ถ้าเป็น null/undefined
 */
const val = (text: string | undefined | null) => (text || '');

/**
 * ดึงค่า number เป็น string หรือ ''
 */
const num = (n: number | undefined | null) => (n !== undefined && n !== null ? n.toString() : '');

/**
 * วาดข้อความ (จัดการ error หากฟอนต์ไม่รองรับ)
 */
function drawText(
    page: any,
    text: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    fallbackFont: PDFFont
) {
    try {
        page.drawText(text, { x, y, font, size, color: rgb(0, 0, 0) });
    } catch (e) {
        // Fallback for characters not supported by the font (e.g., Thai in Helvetica)
        page.drawText('[?]', { x, y, font: fallbackFont, size, color: rgb(1, 0, 0) });
    }
}

/**
 * วาดกล่อง Checkbox
 */
function drawCheckbox(page: any, x: number, y: number, checked = false) {
    const boxSize = 10;
    const yPos = y - boxSize / 2 + 1;
    page.drawRectangle({
        x,
        y: yPos,
        width: boxSize,
        height: boxSize,
        borderWidth: 0.5,
        borderColor: rgb(0, 0, 0),
    });

    if (checked) {
        // วาดเครื่องหมาย 'X'
        page.drawLine({
            start: { x: x + 2, y: yPos + 8 },
            end: { x: x + 8, y: yPos + 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        page.drawLine({
            start: { x: x + 2, y: yPos + 2 },
            end: { x: x + 8, y: yPos + 8 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
    }
}

/**
 * วาดช่อง Checkbox พร้อมข้อความ
 */
function drawCheckField(
    page: any,
    text: string,
    x: number,
    y: number,
    checked: boolean,
    font: PDFFont,
    fallbackFont: PDFFont,
    isThai: boolean
) {
    drawCheckbox(page, x, y, checked);
    if (!isThai) { // Only draw label if font supports it
        drawText(page, text, x + 15, y - 3, font, FONT_SIZE, fallbackFont);
    }
}

/**
 * วาดช่องกรอกข้อมูลพร้อมเส้นใต้
 */
function drawField(
    page: any,
    label: string,
    value: string,
    x: number,
    y: number,
    font: PDFFont,
    fallbackFont: PDFFont,
    isThai: boolean, // To check if the text is Thai
    options: {
        labelWidth?: number,
        fieldWidth?: number,
        valueXOffset?: number
    } = {}
) {
    const { labelWidth = 0, fieldWidth = 100, valueXOffset = 5 } = options;
    const valueYPos = y - 3;
    const lineYPos = y - 5;
    
    if (!isThai) {
        drawText(page, label, x, valueYPos, font, FONT_SIZE, fallbackFont);
    }
    
    const fieldStartX = x + labelWidth;
    
    page.drawLine({
        start: { x: fieldStartX, y: lineYPos },
        end: { x: fieldStartX + fieldWidth, y: lineYPos },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
    });

    if (value && !isThai) {
        drawText(page, value, fieldStartX + valueXOffset, valueYPos, font, FONT_SIZE, fallbackFont);
    }
}


// --- PDF GENERATION FUNCTIONS ---

/**
 * สร้าง PDF ใบสมัครงาน
 */
async function fillApplicationForm(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    let y = height - PAGE_MARGIN;
    const xCol1 = PAGE_MARGIN;
    const xCol2 = 250;
    const xCol3 = 400;
    const contentWidth = width - (PAGE_MARGIN * 2);

    // --- Header ---
    if (isThaiFontLoaded) drawText(page, 'บริษัทเบิกฟ้ากรุ๊ปจำกัด', xCol1, y, boldFont, 14, fallbackFont);
    y -= 16;
    if (isThaiFontLoaded) drawText(page, 'เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น', xCol1, y, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    if (isThaiFontLoaded) drawText(page, 'เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์-แฟ็กซ์ 02-047-7979', xCol1, y, font, FONT_SIZE, fallbackFont);
    y -= (LINE_HEIGHT * 1.5);

    // --- Title ---
    if (isThaiFontLoaded) drawText(page, 'ใบสมัครงาน', contentWidth / 2 + (PAGE_MARGIN / 2), y, boldFont, 16, fallbackFont);
    y -= (LINE_HEIGHT * 2);

    // --- Personal Info ---
    const prefix = data.applicant?.prefix;
    drawCheckField(page, 'นาย', xCol1, y, prefix === 'นาย', font, fallbackFont, !isThaiFontLoaded);
    drawCheckField(page, 'นาง', xCol1 + 50, y, prefix === 'นาง', font, fallbackFont, !isThaiFontLoaded);
    drawCheckField(page, 'นางสาว', xCol1 + 100, y, prefix === 'นางสาว', font, fallbackFont, !isThaiFontLoaded);
    
    drawField(page, 'ชื่อ', val(data.applicant?.firstName), xCol2, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 25, fieldWidth: 100 });
    drawField(page, 'นามสกุล', val(data.applicant?.lastName), xCol3, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 45, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'ชื่อเล่น', val(data.applicant?.nickname), xCol3, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 45, fieldWidth: 100 });
    y -= (LINE_HEIGHT * 1.5);
    
    // --- Current Address ---
    const addr = data.applicant?.currentAddress;
    drawField(page, 'ที่อยู่ปัจจุบันบ้านเลขที่', val(addr?.houseNo), xCol1, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 110, fieldWidth: 100 });
    drawField(page, 'หมู่ที่', val(addr?.moo), xCol2 + 60, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 30, fieldWidth: 65 });
    drawField(page, 'ถนน', val(addr?.street), xCol3, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 45, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'ตำบล/แขวง', val(addr?.subDistrict), xCol1, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'อำเภอ/เขต', val(addr?.district), xCol2 + 60, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 55, fieldWidth: 110 });
    y -= LINE_HEIGHT;
    drawField(page, 'จังหวัด', val(addr?.province), xCol1, y, font, fallbackFont, !isThaiFontLoaded, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'รหัสไปรษณีย์', val(addr?.postalCode), xCol2 + 60, y, font, fallbackFont, false, { labelWidth: 70, fieldWidth: 95 });
    y -= LINE_HEIGHT;
    drawField(page, 'โทรศัพท์', val(data.applicant?.homePhone), xCol1, y, font, fallbackFont, false, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'มือถือ', val(data.applicant?.mobilePhone), xCol2 + 60, y, font, fallbackFont, false, { labelWidth: 35, fieldWidth: 130 });
    y -= LINE_HEIGHT;
    drawField(page, 'อีเมล์', val(data.applicant?.email), xCol1, y, font, fallbackFont, false, { labelWidth: 60, fieldWidth: 305 });
    y -= (LINE_HEIGHT * 1.5);
    
    if (!isThaiFontLoaded) {
        drawText(page, 'Warning: Thai font not loaded. Text is incomplete.', xCol1, 40, fallbackFont, 12, fallbackFont);
    }
    
    return pdfDoc.save();
}

/**
 * สร้าง PDF สัญญาขนส่ง
 */
async function fillTransportContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - PAGE_MARGIN;
    const x = PAGE_MARGIN;
    
    drawText(page, 'Transport Contract', width / 2 - 50, y, boldFont, 16, fallbackFont);
    y -= LINE_HEIGHT * 2;
    
    const contractDate = formatDate(data.contractDetails?.contractDate || new Date(), isThaiFontLoaded);
    drawText(page, `Contract Date: ${contractDate}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;

    const fullName = `${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const addr = data.applicant?.currentAddress;
    const address = `${val(addr?.houseNo)} ${val(addr?.moo)} ${val(addr?.street)} ${val(addr?.subDistrict)} ${val(addr?.district)} ${val(addr?.province)} ${val(addr?.postalCode)}`.trim();

    drawText(page, `Employer: DriveOnboard Co., Ltd.`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    if(isThaiFontLoaded) drawText(page, `Employee (Driver): ${fullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    if(isThaiFontLoaded) drawText(page, `Address: ${address}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `National ID: ${val(data.applicant?.nationalId)}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `Vehicle Used: ${val(data.vehicle?.plateNo)}`, x, y, font, 12, fallbackFont);

    if (!isThaiFontLoaded) {
        drawText(page, 'Warning: Thai font not loaded.', x, 40, fallbackFont, 12, fallbackFont);
    }

    return pdfDoc.save();
}

/**
 * สร้าง PDF สัญญาค้ำประกัน
 */
async function fillGuaranteeContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - PAGE_MARGIN;
    const x = PAGE_MARGIN;

    drawText(page, 'Work Guarantee Contract', width / 2 - 60, y, boldFont, 16, fallbackFont);
    y -= LINE_HEIGHT * 2;

    const contractDate = formatDate(data.guarantor?.contractDate || new Date(), isThaiFontLoaded);
    drawText(page, `Contract Date: ${contractDate}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;
    
    const applicantFullName = `${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const guarantorFullName = `${val(data.guarantor?.firstName)} ${val(data.guarantor?.lastName)}`.trim();
    const guarantorAddr = data.guarantor?.address;
    const guarantorAddress = `${val(guarantorAddr?.houseNo)} ${val(guarantorAddr?.moo)} ${val(guarantorAddr?.street)} ${val(guarantorAddr?.subDistrict)} ${val(guarantorAddr?.district)} ${val(guarantorAddr?.province)} ${val(guarantorAddr?.postalCode)}`.trim();

    if(isThaiFontLoaded) drawText(page, `Guarantor: ${guarantorFullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    if(isThaiFontLoaded) drawText(page, `Guarantor Address: ${guarantorAddress}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `Guarantor National ID: ${val(data.guarantor?.nationalId)}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;
    if(isThaiFontLoaded) drawText(page, `Hereby guarantees: ${applicantFullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `who is an employee of DriveOnboard Co., Ltd.`, x, y, font, 12, fallbackFont);
    
    if (!isThaiFontLoaded) {
        drawText(page, 'Warning: Thai font not loaded.', x, 40, fallbackFont, 12, fallbackFont);
    }

    return pdfDoc.save();
}


/**
 * POST Handler (Main Logic)
 */
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
    return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
  }
}
