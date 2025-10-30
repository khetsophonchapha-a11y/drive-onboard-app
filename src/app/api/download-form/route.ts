
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
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
 * โหลดฟอนต์ภาษาไทย (Sarabun) และฟอนต์สำรอง (Helvetica)
 * @param pdfDoc เอกสาร PDF ที่จะฝังฟอนต์
 * @returns อ็อบเจกต์ที่มีฟอนต์หลักและฟอนต์สำรอง
 */
async function loadFonts(pdfDoc: PDFDocument) {
    let font: PDFFont;
    let boldFont: PDFFont;
    let isThaiFontLoaded = false;

    // ตำแหน่งฟอนต์ที่คาดหวังในโปรเจกต์ Next.js
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf');
    const boldFontPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Bold.ttf');

    try {
        const fontBytes = await fs.readFile(fontPath);
        const boldFontBytes = await fs.readFile(boldFontPath);

        font = await pdfDoc.embedFont(fontBytes);
        boldFont = await pdfDoc.embedFont(boldFontBytes);
        isThaiFontLoaded = true;
    } catch (error) {
        console.warn(`[Font Loading Warning] Could not load Thai fonts from ${fontPath}. Falling back to Helvetica. Thai text will not render correctly.`);
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        isThaiFontLoaded = false;
    }

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
        const locale = useThaiLocale ? { locale: th } : {};
        // ถ้าใช้ฟอนต์ไทย ให้แสดงผลแบบไทย
        if (useThaiLocale) {
            return format(dateObj, 'd MMMM yyyy', locale);
        }
        // ถ้าไม่ (เช่น ใช้ Helvetica) ให้แสดงผลแบบสากล
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
        // ถ้าฟอนต์หลัก (เช่น Sarabun) ไม่รองรับอักขระ (ไม่น่าเกิด)
        // หรือถ้าฟอนต์สำรอง (Helvetica) ไม่รองรับ (เช่น ภาษาไทย)
        // ให้วาดสัญลักษณ์ [?] แทน
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
    fallbackFont: PDFFont
) {
    drawCheckbox(page, x, y, checked);
    drawText(page, text, x + 15, y - 3, font, FONT_SIZE, fallbackFont);
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
    options: {
        labelWidth?: number,
        fieldWidth?: number,
        valueXOffset?: number
    } = {}
) {
    const { labelWidth = 0, fieldWidth = 100, valueXOffset = 5 } = options;
    const valueYPos = y - 3;
    const lineYPos = y - 5;
    
    // วาด Label
    drawText(page, label, x, valueYPos, font, FONT_SIZE, fallbackFont);
    
    const fieldStartX = x + labelWidth;
    
    // วาดเส้นใต้
    page.drawLine({
        start: { x: fieldStartX, y: lineYPos },
        end: { x: fieldStartX + fieldWidth, y: lineYPos },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
    });

    // วาด Value
    if (value) {
        drawText(page, value, fieldStartX + valueXOffset, valueYPos, font, FONT_SIZE, fallbackFont);
    }
}


// --- PDF GENERATION FUNCTIONS ---

/**
 * สร้าง PDF ใบสมัครงาน (แก้ไขใหม่ทั้งหมด)
 */
async function fillApplicationForm(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    // โหลดฟอนต์
    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    let y = height - PAGE_MARGIN;
    const xCol1 = PAGE_MARGIN;
    const xCol2 = 250;
    const xCol3 = 400;
    const contentWidth = width - (PAGE_MARGIN * 2);

    // --- Header ---
    drawText(page, 'บริษัทเบิกฟ้ากรุ๊ปจำกัด', xCol1, y, boldFont, 14, fallbackFont);
    y -= 16;
    drawText(page, 'เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น', xCol1, y, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, 'เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์-แฟ็กซ์ 02-047-7979', xCol1, y, font, FONT_SIZE, fallbackFont);
    y -= (LINE_HEIGHT * 1.5);

    // --- Title ---
    drawText(page, 'ใบสมัครงาน', (width / 2) - (boldFont.widthOfTextAtSize('ใบสมัครงาน', 16) / 2), y, boldFont, 16, fallbackFont);
    y -= (LINE_HEIGHT * 2);

    // --- Personal Info ---
    const prefix = data.applicant?.prefix;
    drawCheckField(page, 'นาย', xCol1, y, prefix === 'นาย', font, fallbackFont);
    drawCheckField(page, 'นาง', xCol1 + 50, y, prefix === 'นาง', font, fallbackFont);
    drawCheckField(page, 'นางสาว', xCol1 + 100, y, prefix === 'นางสาว', font, fallbackFont);
    
    drawField(page, 'ชื่อ', val(data.applicant?.firstName), xCol2, y, font, fallbackFont, { labelWidth: 25, fieldWidth: 100 });
    drawField(page, 'นามสกุล', val(data.applicant?.lastName), xCol3, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'ชื่อเล่น', val(data.applicant?.nickname), xCol3, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 100 });
    y -= (LINE_HEIGHT * 1.5);
    
    // --- Current Address ---
    const addr = data.applicant?.currentAddress;
    drawField(page, 'ที่อยู่ปัจจุบันบ้านเลขที่', val(addr?.houseNo), xCol1, y, font, fallbackFont, { labelWidth: 110, fieldWidth: 100 });
    drawField(page, 'หมู่ที่', val(addr?.moo), xCol2 + 60, y, font, fallbackFont, { labelWidth: 30, fieldWidth: 65 });
    drawField(page, 'ถนน', val(addr?.street), xCol3, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'ตำบล/แขวง', val(addr?.subDistrict), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'อำเภอ/เขต', val(addr?.district), xCol2 + 60, y, font, fallbackFont, { labelWidth: 55, fieldWidth: 110 });
    y -= LINE_HEIGHT;
    drawField(page, 'จังหวัด', val(addr?.province), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'รหัสไปรษณีย์', val(addr?.postalCode), xCol2 + 60, y, font, fallbackFont, { labelWidth: 70, fieldWidth: 95 });
    y -= LINE_HEIGHT;
    drawField(page, 'โทรศัพท์', val(data.applicant?.homePhone), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'มือถือ', val(data.applicant?.mobilePhone), xCol2 + 60, y, font, fallbackFont, { labelWidth: 35, fieldWidth: 130 });
    y -= LINE_HEIGHT;
    drawField(page, 'อีเมล์', val(data.applicant?.email), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 305 });
    y -= (LINE_HEIGHT * 1.5);

    // --- Permanent Address ---
    const permAddr = data.applicant?.permanentAddress;
    drawField(page, 'ที่อยู่ตามทะเบียนบ้านเลขที่', val(permAddr?.houseNo), xCol1, y, font, fallbackFont, { labelWidth: 125, fieldWidth: 85 });
    drawField(page, 'หมู่ที่', val(permAddr?.moo), xCol2 + 60, y, font, fallbackFont, { labelWidth: 30, fieldWidth: 65 });
    drawField(page, 'ถนน', val(permAddr?.street), xCol3, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'ตำบล/แขวง', val(permAddr?.subDistrict), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'อำเภอ/เขต', val(permAddr?.district), xCol2 + 60, y, font, fallbackFont, { labelWidth: 55, fieldWidth: 110 });
    y -= LINE_HEIGHT;
    drawField(page, 'จังหวัด', val(permAddr?.province), xCol1, y, font, fallbackFont, { labelWidth: 60, fieldWidth: 150 });
    drawField(page, 'รหัสไปรษณีย์', val(permAddr?.postalCode), xCol2 + 60, y, font, fallbackFont, { labelWidth: 70, fieldWidth: 95 });
    y -= (LINE_HEIGHT * 1.5);

    // --- Residence Status ---
    drawText(page, 'อาศัยอยู่กับ', xCol1, y - 3, font, FONT_SIZE, fallbackFont);
    const resType = data.applicant?.residenceType;
    drawCheckField(page, 'บ้านตัวเอง', xCol1 + 70, y, resType === 'own', font, fallbackFont);
    drawCheckField(page, 'บ้านเช่า', xCol1 + 150, y, resType === 'rent', font, fallbackFont);
    drawCheckField(page, 'หอพัก', xCol1 + 220, y, resType === 'dorm', font, fallbackFont);
    y -= (LINE_HEIGHT * 1.5);
    
    // --- Personal Details (DOB, Age, etc) ---
    let dobDay = '', dobMonth = '', dobYear = '';
    if (data.applicant?.dateOfBirth) {
        try {
            const dob = parseISO(data.applicant.dateOfBirth as unknown as string);
            dobDay = format(dob, 'd');
            dobMonth = isThaiFontLoaded ? format(dob, 'MMMM', { locale: th }) : format(dob, 'MM');
            dobYear = isThaiFontLoaded ? (parseInt(format(dob, 'yyyy')) + 543).toString() : format(dob, 'yyyy');
        } catch {}
    }
    
    drawField(page, 'เกิดวันที่', dobDay, xCol1, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 40 });
    drawField(page, 'เดือน', dobMonth, xCol1 + 95, y, font, fallbackFont, { labelWidth: 30, fieldWidth: 65 });
    drawField(page, 'พ.ศ.', dobYear, xCol1 + 200, y, font, fallbackFont, { labelWidth: 25, fieldWidth: 45 });
    drawField(page, 'อายุ', num(data.applicant?.age), xCol1 + 280, y, font, fallbackFont, { labelWidth: 25, fieldWidth: 30 });
    drawText(page, 'ปี', xCol1 + 340, y - 3, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    drawField(page, 'เชื้อชาติ', val(data.applicant?.race), xCol1, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 80 });
    drawField(page, 'สัญชาติ', val(data.applicant?.nationality), xCol1 + 135, y, font, fallbackFont, { labelWidth: 40, fieldWidth: 80 });
    drawField(page, 'ศาสนา', val(data.applicant?.religion), xCol1 + 265, y, font, fallbackFont, { labelWidth: 40, fieldWidth: 80 });
    y -= LINE_HEIGHT;
    drawField(page, 'บัตรประชาชนเลขที่', val(data.applicant?.nationalId), xCol1, y, font, fallbackFont, { labelWidth: 100, fieldWidth: 150 });
    y -= LINE_HEIGHT;
    drawField(page, 'วันที่ออกบัตร', formatDate(data.applicant?.nationalIdIssueDate, isThaiFontLoaded), xCol1, y, font, fallbackFont, { labelWidth: 70, fieldWidth: 130 });
    drawField(page, 'วันที่บัตรหมดอายุ', formatDate(data.applicant?.nationalIdExpiryDate, isThaiFontLoaded), xCol1 + 210, y, font, fallbackFont, { labelWidth: 90, fieldWidth: 130 });
    y -= LINE_HEIGHT;
    drawField(page, 'ส่วนสูง', num(data.applicant?.height), xCol1, y, font, fallbackFont, { labelWidth: 40, fieldWidth: 50 });
    drawText(page, 'ซม.', xCol1 + 95, y - 3, font, FONT_SIZE, fallbackFont);
    drawField(page, 'น้ำหนัก', num(data.applicant?.weight), xCol1 + 130, y, font, fallbackFont, { labelWidth: 40, fieldWidth: 50 });
    drawText(page, 'กก.', xCol1 + 185, y - 3, font, FONT_SIZE, fallbackFont);
    y -= (LINE_HEIGHT * 1.5);
    
    // --- Military, Marital, Gender ---
    drawText(page, 'ภาวะทางทหาร', xCol1, y - 3, font, FONT_SIZE, fallbackFont);
    const milStatus = data.applicant?.militaryStatus;
    drawCheckField(page, 'ยกเว้น', xCol1 + 80, y, milStatus === 'exempt', font, fallbackFont);
    drawCheckField(page, 'ปลดเป็นทหารกองหนุน', xCol1 + 140, y, milStatus === 'discharged', font, fallbackFont);
    drawCheckField(page, 'ยังไม่ได้รับการเกณฑ์', xCol1 + 280, y, milStatus === 'not-drafted', font, fallbackFont);
    y -= LINE_HEIGHT;
    
    drawText(page, 'สถานภาพ', xCol1, y - 3, font, FONT_SIZE, fallbackFont);
    const marStatus = data.applicant?.maritalStatus;
    drawCheckField(page, 'โสด', xCol1 + 80, y, marStatus === 'single', font, fallbackFont);
    drawCheckField(page, 'แต่งงาน', xCol1 + 140, y, marStatus === 'married', font, fallbackFont);
    drawCheckField(page, 'หม้าย', xCol1 + 210, y, marStatus === 'widowed', font, fallbackFont);
    drawCheckField(page, 'หย่าร้าง', xCol1 + 270, y, marStatus === 'divorced', font, fallbackFont);
    
    drawText(page, 'เพศ', xCol3 + 50, y - 3, font, FONT_SIZE, fallbackFont);
    const gender = data.applicant?.gender;
    drawCheckField(page, 'หญิง', xCol3 + 80, y, gender === 'female', font, fallbackFont);
    drawCheckField(page, 'ชาย', xCol3 + 130, y, gender === 'male', font, fallbackFont);
    y -= (LINE_HEIGHT * 1.5);

    // --- Emergency Contact ---
    const emCon = data.applicationDetails?.emergencyContact;
    drawText(page, 'บุคคลที่ติดต่อได้กรณีฉุกเฉิน', xCol1, y - 3, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    drawField(page, 'ชื่อ', val(emCon?.firstName), xCol1, y, font, fallbackFont, { labelWidth: 20, fieldWidth: 140 });
    drawField(page, 'นามสกุล', val(emCon?.lastName), xCol1 + 170, y, font, fallbackFont, { labelWidth: 45, fieldWidth: 140 });
    drawField(page, 'อาชีพ', val(emCon?.occupation), xCol1 + 365, y, font, fallbackFont, { labelWidth: 35, fieldWidth: 100 });
    y -= LINE_HEIGHT;
    drawField(page, 'เกี่ยวข้องเป็น', val(emCon?.relation), xCol1, y, font, fallbackFont, { labelWidth: 70, fieldWidth: 130 });
    drawField(page, 'มือถือ', val(emCon?.mobilePhone), xCol1 + 210, y, font, fallbackFont, { labelWidth: 35, fieldWidth: 130 });
    y -= (LINE_HEIGHT * 1.5);
    
    // --- Application Details ---
    drawField(page, 'ตำแหน่งที่ต้องการสมัคร', val(data.applicationDetails?.position), xCol1, y, font, fallbackFont, { labelWidth: 120, fieldWidth: 200 });
    y -= (LINE_HEIGHT * 1.5);
    
    drawText(page, 'เคยต้องโทษทางคดีอาญาหรือไม่', xCol1, y - 3, font, FONT_SIZE, fallbackFont);
    const crimRec = data.applicationDetails?.criminalRecord;
    drawCheckField(page, 'เคย', xCol1 + 150, y, crimRec === 'yes', font, fallbackFont);
    drawCheckField(page, 'ไม่เคย', xCol1 + 200, y, crimRec === 'no', font, fallbackFont);
    y -= (LINE_HEIGHT * 2);

    // --- Declaration ---
    const declarationText1 = 'ข้าพเจ้าขอสัญญาว่าถ้าได้รับการพิจารณาได้เป็นพนักงานของบริษัทฯจะตั้งใจปฏิบัติหน้าที่อย่างเต็มที่จะซื่อตรง';
    const declarationText2 = 'พร้อมทั้งจะรักษาผลประโยชน์ของบริษัททุกกรณี และหวังเป็นอย่างยิ่งว่าจะได้รับการพิจารณารับเข้าทำงาน';
    const declarationText3 = 'จึงขอขอบพระคุณมา ณ โอกาสนี้';
    
    drawText(page, declarationText1, xCol1, y, font, FONT_SIZE_SMALL, fallbackFont);
    y -= (LINE_HEIGHT * 0.75);
    drawText(page, declarationText2, xCol1, y, font, FONT_SIZE_SMALL, fallbackFont);
    y -= (LINE_HEIGHT * 0.75);
    drawText(page, declarationText3, xCol1, y, font, FONT_SIZE_SMALL, fallbackFont);
    y -= (LINE_HEIGHT * 3);

    // --- Signature ---
    const applicantName = `${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    drawField(page, 'ลงชื่อ', '', xCol3 - 20, y, font, fallbackFont, { labelWidth: 35, fieldWidth: 150, valueXOffset: 40 });
    drawText(page, 'ผู้สมัคร', xCol3 + 170, y - 3, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `( ${applicantName} )`, xCol3, y - 3, font, FONT_SIZE, fallbackFont);
    y -= LINE_HEIGHT;
    drawField(page, 'ลงวันที่สมัครงาน', formatDate(data.applicationDetails?.applicationDate, isThaiFontLoaded), xCol3 - 20, y, font, fallbackFont, { labelWidth: 85, fieldWidth: 120 });
    
    // --- Warning if font failed ---
    if (!isThaiFontLoaded) {
        drawText(page, 'Warning: Thai font not loaded. Text is incomplete.', xCol1, 40, fallbackFont, 12, fallbackFont);
    }
    
    return pdfDoc.save();
}

/**
 * สร้าง PDF สัญญาขนส่ง (อัปเดตให้ใช้ฟอนต์ไทย)
 */
async function fillTransportContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - PAGE_MARGIN;
    const x = PAGE_MARGIN;
    
    drawText(page, 'สัญญาจ้างขนส่ง', (width / 2) - (boldFont.widthOfTextAtSize('สัญญาจ้างขนส่ง', 16) / 2), y, boldFont, 16, fallbackFont);
    y -= LINE_HEIGHT * 2;
    
    const contractDate = formatDate(data.contractDetails?.contractDate || new Date(), isThaiFontLoaded);
    drawText(page, `วันที่ทำสัญญา: ${contractDate}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;

    const fullName = `${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const addr = data.applicant?.currentAddress;
    const address = `${val(addr?.houseNo)} ${val(addr?.moo)} ${val(addr?.street)} ${val(addr?.subDistrict)} ${val(addr?.district)} ${val(addr?.province)} ${val(addr?.postalCode)}`.trim();

    drawText(page, `ผู้ว่าจ้าง: บริษัท ไดร์ฟออนบอร์ด จำกัด`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `ผู้รับจ้าง (พนักงานขับรถ): ${fullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `ที่อยู่: ${address}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `เลขบัตรประชาชน: ${val(data.applicant?.nationalId)}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `รถยนต์ที่ใช้: ${val(data.vehicle?.plateNo)}`, x, y, font, 12, fallbackFont);

    if (!isThaiFontLoaded) {
        drawText(page, 'Warning: Thai font not loaded.', x, 40, fallbackFont, 12, fallbackFont);
    }

    return pdfDoc.save();
}

/**
 * สร้าง PDF สัญญาค้ำประกัน (อัปเดตให้ใช้ฟอนต์ไทย)
 */
async function fillGuaranteeContract(data: Manifest): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const { font, boldFont, isThaiFontLoaded } = await loadFonts(pdfDoc);
    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - PAGE_MARGIN;
    const x = PAGE_MARGIN;

    drawText(page, 'สัญญาค้ำประกันการทำงาน', (width / 2) - (boldFont.widthOfTextAtSize('สัญญาค้ำประกันการทำงาน', 16) / 2), y, boldFont, 16, fallbackFont);
    y -= LINE_HEIGHT * 2;

    const contractDate = formatDate(data.guarantor?.contractDate || new Date(), isThaiFontLoaded);
    drawText(page, `วันที่ทำสัญญา: ${contractDate}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;
    
    const applicantFullName = `${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`.trim();
    const guarantorFullName = `${val(data.guarantor?.firstName)} ${val(data.guarantor?.lastName)}`.trim();
    const guarantorAddr = data.guarantor?.address;
    const guarantorAddress = `${val(guarantorAddr?.houseNo)} ${val(guarantorAddr?.moo)} ${val(guarantorAddr?.street)} ${val(guarantorAddr?.subDistrict)} ${val(guarantorAddr?.district)} ${val(guarantorAddr?.province)} ${val(guarantorAddr?.postalCode)}`.trim();

    drawText(page, `ผู้ค้ำประกัน: ${guarantorFullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `ที่อยู่ผู้ค้ำประกัน: ${guarantorAddress}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `เลขบัตรประชาชนผู้ค้ำประกัน: ${val(data.guarantor?.nationalId)}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT * 2;
    drawText(page, `ตกลงค้ำประกัน: ${applicantFullName}`, x, y, font, 12, fallbackFont);
    y -= LINE_HEIGHT;
    drawText(page, `ซึ่งเป็นพนักงานของ บริษัท ไดร์ฟออนบอร์ด จำกัด`, x, y, font, 12, fallbackFont);
    
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
    // This is the error that gets thrown back to the client
    return NextResponse.json({ error: `PDF Generation Failed: ${message}` }, { status: 500 });
  }
}

    