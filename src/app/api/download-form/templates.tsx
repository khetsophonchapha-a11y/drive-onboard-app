import React from 'react';
import type { Manifest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Helpers ---

/**
 * ดึงค่า string หรือ '' ถ้าเป็น null/undefined
 */
const val = (text: string | undefined | null) => (text || '');

/**
 * ดึงค่า number เป็น string หรือ ''
 */
const num = (n: number | undefined | null) => (n !== undefined && n !== null ? n.toString() : '');

/**
 * จัดรูปแบบวันที่
 */
function formatDate(date: string | Date | undefined): string {
    if (!date) return '..............................';
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        // ใช้ Locale ไทย และ +543 ปี
        const year = parseInt(format(dateObj, 'yyyy')) + 543;
        const dayAndMonth = format(dateObj, 'd MMMM', { locale: th });
        return `${dayAndMonth} ${year}`;
    } catch {
        return '..............................';
    }
}

/**
 * Style สำหรับหน้ากระดาษ A4
 * ใช้ Inline Styles ทั้งหมด เพราะ Puppeteer จะอ่านได้ง่ายที่สุด
 */
const pageStyle: React.CSSProperties = {
    width: '100%', // ให้เต็มความกว้าง A4 ที่ตั้งค่าใน puppeteer
    minHeight: '297mm',
    padding: '0', // เราคุมระยะขอบด้วย puppeteer margin
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: '"Sarabun", "Arial", sans-serif', // **สำคัญ: Chrome จะโหลดจาก @font-face ที่เราใส่ใน <head>**
    fontSize: '10pt',
    color: '#000',
    lineHeight: 1.5,
};

const h1Style: React.CSSProperties = {
    fontSize: '16pt',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: '0 0 20px 0',
};

// Style สำหรับช่องกรอกข้อมูล (Label + ขีดเส้นใต้)
const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
    flexShrink: 0, // ไม่ให้ย่อ
    marginRight: '5px',
    paddingBottom: '2px', // ยก label ให้ตรงกับ value
};

const valueStyle: React.CSSProperties = {
    flexGrow: 1, // เติมเต็มพื้นที่
    borderBottom: '1px dotted #555',
    minHeight: '20px',
    paddingLeft: '5px',
    whiteSpace: 'nowrap', // ไม่ตัดคำ
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.2', // ปรับ line-height ให้พอดี
};

// Style สำหรับ Checkbox
const checkRootStyle: React.CSSProperties = {
    marginRight: '15px', 
    whiteSpace: 'nowrap',
    display: 'inline-block', // ทำให้เป็นแถวเดียวกัน
};

const checkStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '1px solid #000',
    marginRight: '5px',
    verticalAlign: 'middle',
    position: 'relative',
    top: '-1px',
    backgroundColor: '#fff', // ทำให้พื้นหลังเป็นสีขาวเสมอ
};

const checkStyleChecked: React.CSSProperties = {
    ...checkStyle,
    textAlign: 'center',
    lineHeight: '12px',
    fontWeight: 'bold',
};

/**
 * Checkbox Component (ง่ายๆ)
 */
const Checkbox = ({ label, checked }: { label: string, checked: boolean }) => (
    <span style={checkRootStyle}>
        <span style={checked ? checkStyleChecked : checkStyle}>
            {checked ? 'X' : <>&nbsp;</>}
        </span>
        <label>{label}</label>
    </span>
);


// --- 1. TEMPLATE: ใบสมัครงาน ---

export const ApplicationFormTemplate = ({ data }: { data: Manifest }) => {
    const app = data.applicant || {};
    const addr = app.currentAddress || {};
    const permAddr = app.permanentAddress || {};
    const emCon = data.applicationDetails?.emergencyContact || {};
    const appDetails = data.applicationDetails || {};
    
    // แยกวัน/เดือน/ปีเกิด
    let dobDay = '', dobMonth = '', dobYear = '';
    if (app.dateOfBirth) {
        try {
            const dob = parseISO(app.dateOfBirth as unknown as string);
            dobDay = format(dob, 'd');
            dobMonth = format(dob, 'MMMM', { locale: th });
            dobYear = (parseInt(format(dob, 'yyyy')) + 543).toString();
        } catch {}
    }

    return (
        <div style={pageStyle}>
            {/* Header */}
            <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>บริษัทเบิกฟ้ากรุ๊ปจำกัด</div>
                <div style={{ fontSize: '10pt' }}>เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น</div>
                <div style={{ fontSize: '10pt' }}>เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์-แฟ็กซ์ 02-047-7979</div>
            </div>

            <h1 style={h1Style}>ใบสมัครงาน</h1>

            {/* Personal Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                    <Checkbox label="นาย" checked={app.prefix === 'นาย'} />
                    <Checkbox label="นาง" checked={app.prefix === 'นาง'} />
                    <Checkbox label="นางสาว" checked={app.prefix === 'นางสาว'} />
                </div>
                <div style={{ flex: 1, display: 'flex', marginLeft: '20px' }}>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>ชื่อ</span>
                        <span style={valueStyle}>{val(app.firstName)}</span>
                    </div>
                    <div style={{...fieldStyle, flex: 1, marginLeft: '10px'}}>
                        <span style={labelStyle}>นามสกุล</span>
                        <span style={valueStyle}>{val(app.lastName)}</span>
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                 <div style={{...fieldStyle, width: '48%', marginLeft: 'auto'}}>
                    <span style={labelStyle}>ชื่อเล่น</span>
                    <span style={valueStyle}>{val(app.nickname)}</span>
                </div>
            </div>

            {/* Current Address */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                 <div style={{...fieldStyle, flex: 2}}>
                    <span style={labelStyle}>ที่อยู่ปัจจุบันบ้านเลขที่</span>
                    <span style={valueStyle}>{val(addr.houseNo)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>หมู่ที่</span>
                    <span style={valueStyle}>{val(addr.moo)}</span>
                </div>
                <div style={{...fieldStyle, flex: 2}}>
                    <span style={labelStyle}>ถนน</span>
                    <span style={valueStyle}>{val(addr.street)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>ตำบล/แขวง</span>
                    <span style={valueStyle}>{val(addr.subDistrict)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>อำเภอ/เขต</span>
                    <span style{...valueStyle}>{val(addr.district)}</span>
                </div>
            </div>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>จังหวัด</span>
                    <span style={valueStyle}>{val(addr.province)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>รหัสไปรษณีย์</span>
                    <span style={valueStyle}>{val(addr.postalCode)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>โทรศัพท์</span>
                    <span style={valueStyle}>{val(app.homePhone)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>มือถือ</span>
                    <span style={valueStyle}>{val(app.mobilePhone)}</span>
                </div>
            </div>
            <div style={{...fieldStyle, flex: 1, marginBottom: '15px'}}>
                <span style={labelStyle}>อีเมล์</span>
                <span style={valueStyle}>{val(app.email)}</span>
            </div>

            {/* Permanent Address */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                 <div style={{...fieldStyle, flex: 2}}>
                    <span style={labelStyle}>ที่อยู่ตามทะเบียนบ้านเลขที่</span>
                    <span style={valueStyle}>{val(permAddr.houseNo)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>หมู่ที่</span>
                    <span style={valueStyle}>{val(permAddr.moo)}</span>
                </div>
                <div style={{...fieldStyle, flex: 2}}>
                    <span style={labelStyle}>ถนน</span>
                    <span style={valueStyle}>{val(permAddr.street)}</span>
                </div>
            </div>
            {/* ... (เติมส่วนที่เหลือของ Permanent Address) ... */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>จังหวัด</span>
                    <span style={valueStyle}>{val(permAddr.province)}</span>
                </div>
                 <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>รหัสไปรษณีย์</span>
                    <span style={valueStyle}>{val(permAddr.postalCode)}</span>
                </div>
            </div>
            
            {/* Residence Status */}
            <div style={{ marginBottom: '15px' }}>
                <span style={labelStyle}>อาศัยอยู่กับ</span>
                <Checkbox label="บ้านตัวเอง" checked={app.residenceType === 'own'} />
                <Checkbox label="บ้านเช่า" checked={app.residenceType === 'rent'} />
                <Checkbox label="หอพัก" checked={app.residenceType === 'dorm'} />
            </div>

            {/* Personal Details (DOB, Age, etc) */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>เกิดวันที่</span>
                    <span style={valueStyle}>{dobDay}</span>
                </div>
                <div style={{...fieldStyle, flex: 1.5}}>
                    <span style={labelStyle}>เดือน</span>
                    <span style={valueStyle}>{dobMonth}</span>
                </div>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>พ.ศ.</span>
                    <span style={valueStyle}>{dobYear}</span>
                </div>
                 <div style={{...fieldStyle, flex: 0.8}}>
                    <span style={labelStyle}>อายุ</span>
                    <span style={valueStyle}>{num(app.age)}</span>
                </div>
                 <span style={labelStyle}>ปี</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>เชื้อชาติ</span>
                    <span style={valueStyle}>{val(app.race)}</span>
                </div>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>สัญชาติ</span>
                    <span style={valueStyle}>{val(app.nationality)}</span>
                </div>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>ศาสนา</span>
                    <span style={valueStyle}>{val(app.religion)}</span>
                </div>
            </div>
            <div style={{...fieldStyle, flex: 1, marginBottom: '8px'}}>
                <span style={labelStyle}>บัตรประชาชนเลขที่</span>
                <span style={valueStyle}>{val(app.nationalId)}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>วันที่ออกบัตร</span>
                    <span style={valueStyle}>{formatDate(app.nationalIdIssueDate)}</span>
                </div>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>วันที่บัตรหมดอายุ</span>
                    <span style={valueStyle}>{formatDate(app.nationalIdExpiryDate)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                <div style={{...fieldStyle, flex: 1}}>
                    <span style={labelStyle}>ส่วนสูง</span>
                    <span style={valueStyle}>{num(app.height)}</span>
                </div>
                <span style={labelStyle}>ซม.</span>
                 <div style={{...fieldStyle, flex: 1, marginLeft: '10px'}}>
                    <span style={labelStyle}>น้ำหนัก</span>
                    <span style={valueStyle}>{num(app.weight)}</span>
                </div>
                <span style={labelStyle}>กก.</span>
            </div>
            
            {/* Military, Marital, Gender */}
             <div style={{ marginBottom: '8px' }}>
                <span style={labelStyle}>ภาวะทางทหาร</span>
                <Checkbox label="ยกเว้น" checked={app.militaryStatus === 'exempt'} />
                <Checkbox label="ปลดเป็นทหารกองหนุน" checked={app.militaryStatus === 'discharged'} />
                <Checkbox label="ยังไม่ได้รับการเกณฑ์" checked={app.militaryStatus === 'not-drafted'} />
            </div>
             <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <span style={labelStyle}>สถานภาพ</span>
                    <Checkbox label="โสด" checked={app.maritalStatus === 'single'} />
                    <Checkbox label="แต่งงาน" checked={app.maritalStatus === 'married'} />
                    <Checkbox label="หม้าย" checked={app.maritalStatus === 'widowed'} />
                    <Checkbox label="หย่าร้าง" checked={app.maritalStatus === 'divorced'} />
                </div>
                 <div>
                    <span style={labelStyle}>เพศ</span>
                    <Checkbox label="หญิง" checked={app.gender === 'female'} />
                    <Checkbox label="ชาย" checked={app.gender === 'male'} />
                </div>
            </div>

            {/* Emergency Contact */}
            <div style={{ marginTop: '15px' }}>
                <span style={{...labelStyle, fontWeight: 'bold'}}>บุคคลที่ติดต่อได้กรณีฉุกเฉิน</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>ชื่อ</span>
                        <span style={valueStyle}>{val(emCon.firstName)}</span>
                    </div>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>นามสกุล</span>
                        <span style={valueStyle}>{val(emCon.lastName)}</span>
                    </div>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>อาชีพ</span>
                        <span style={valueStyle}>{val(emCon.occupation)}</span>
                    </div>
                </div>
                 <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>เกี่ยวข้องเป็น</span>
                        <span style={valueStyle}>{val(emCon.relation)}</span>
                    </div>
                    <div style={{...fieldStyle, flex: 1}}>
                        <span style={labelStyle}>มือถือ</span>
                        <span style={valueStyle}>{val(emCon.mobilePhone)}</span>
                    </div>
                </div>
            </div>

            {/* Application Details */}
            <div style={{...fieldStyle, flex: 1, marginBottom: '8px'}}>
                <span style={labelStyle}>ตำแหน่งที่ต้องการสมัคร</span>
                <span style={valueStyle}>{val(appDetails.position)}</span>
            </div>
             <div style={{ marginBottom: '15px' }}>
                <span style={labelStyle}>เคยต้องโทษทางคดีอาญาหรือไม่</span>
                <Checkbox label="เคย" checked={appDetails.criminalRecord === 'yes'} />
                <Checkbox label="ไม่เคย" checked={appDetails.criminalRecord === 'no'} />
            </div>

            {/* Declaration & Signature */}
            <div style={{ marginTop: '20px', fontSize: '9pt' }}>
                <p style={{margin: '3px 0'}}>ข้าพเจ้าขอสัญญาว่าถ้าได้รับการพิจารณาได้เป็นพนักงานของบริษัทฯจะตั้งใจปฏิบัติหน้าที่อย่างเต็มที่จะซื่อตรง</p>
                <p style={{margin: '3px 0'}}>พร้อมทั้งจะรักษาผลประโยชน์ของบริษัททุกกรณี และหวังเป็นอย่างยิ่งว่าจะได้รับการพิจารณารับเข้าทำงาน</p>
                <p style={{margin: '3px 0'}}>จึงขอขอบพระคุณมา ณ โอกาสนี้</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
                <div style={{ width: '280px' }}>
                    <div style={{...fieldStyle}}>
                        <span style={labelStyle}>ลงชื่อ</span>
                        <span style={valueStyle}>&nbsp;</span> {/* ช่องว่างสำหรับเซ็น */}
                        <span style={{...labelStyle, marginLeft: '5px'}}>ผู้สมัคร</span>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '5px', paddingRight: '40px' }}>
                        ( {val(app.prefix)}{val(app.firstName)} {val(app.lastName)} )
                    </div>
                     <div style={{...fieldStyle, marginTop: '10px'}}>
                        <span style={labelStyle}>ลงวันที่สมัครงาน</span>
                        <span style={valueStyle}>{formatDate(appDetails.applicationDate)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- 2. TEMPLATE: สัญญาจ้างขนส่ง ---

export const TransportContractTemplate = ({ data }: { data: Manifest }) => {
    // ... (สร้าง Template HTML สำหรับสัญญาขนส่งที่นี่) ...
    return (
        <div style={pageStyle}>
            <h1 style={h1Style}>สัญญาจ้างขนส่ง</h1>
            <p>วันที่ทำสัญญา: {formatDate(data.contractDetails?.contractDate || new Date())}</p>
            <p>ผู้ว่าจ้าง: บริษัท ไดร์ฟออนบอร์ด จำกัด</p>
            <p>ผู้รับจ้าง: {val(data.applicant?.prefix)}{val(data.applicant?.firstName)} {val(data.applicant?.lastName)}</p>
            {/* ... (รายละเอียดอื่นๆ) ... */}
        </div>
    );
};

// --- 3. TEMPLATE: สัญญาค้ำประกัน ---

export const GuaranteeContractTemplate = ({ data }: { data: Manifest }) => {
    // ... (สร้าง Template HTML สำหรับสัญญาค้ำประกันที่นี่) ...
     return (
        <div style={pageStyle}>
            <h1 style={h1Style}>สัญญาค้ำประกันการทำงาน</h1>
            <p>วันที่ทำสัญญา: {formatDate(data.guarantor?.contractDate || new Date())}</p>
            <p>ผู้ค้ำประกัน: {val(data.guarantor?.firstName)} {val(data.guarantor?.lastName)}</p>
            <p>ตกลงค้ำประกัน: {val(data.applicant?.prefix)}{val(data.applicant?.firstName)} {val(data.applicant?.lastName)}</p>
            {/* ... (รายละเอียดอื่นๆ) ... */}
        </div>
    );
};

