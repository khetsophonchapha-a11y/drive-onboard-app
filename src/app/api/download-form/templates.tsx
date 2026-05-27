/**
 * src/app/api/download-form/templates.tsx
 * Use React components to generate HTML for PDF conversion via Google Apps Script.
 */

import React from 'react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import type { Manifest } from '@/lib/types';

// Helper for optional values
const val = (text: string | number | undefined | null) => (text || '');
const num = (n: number | undefined | null) => (n !== undefined && n !== null ? n : '-');

function formatDate(date: string | Date | undefined): string {
    if (!date) return '..............................';
    try {
        const d = typeof date === 'string' ? parseISO(date) : date;
        const day = format(d, 'd');
        const month = format(d, 'MMMM', { locale: th }); // Full Thai month name
        const year = parseInt(format(d, 'yyyy')) + 543;
        return `${day} / ${month} / ${year}`;
    } catch {
        return '..............................';
    }
}

// Extend Manifest type for internal use within templates
type ManifestWithSignatures = Manifest & {
    signatures?: {
        applicant?: string | null;
        guarantor?: string | null;
    };
    pdfAssets?: {
        logoDataUrl?: string | null;
        regularFontDataUrl?: string | null;
        boldFontDataUrl?: string | null;
    };
};

// Styling Constants
const pageStyle: React.CSSProperties = {
    width: '100%',
    padding: '0',
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: '"TH Sarabun New", "THSarabunNew", "Sarabun", "Arial", sans-serif',
    fontSize: '9pt',
    color: '#000',
    lineHeight: 1.5,
};

const COMPANY_NAME_TH = 'บริษัท เบิกฟ้ากรุ๊ป จำกัด';
const COMPANY_NAME_EN = 'BOEKFAH GROUP CO.,LTD.';
const COMPANY_ADDRESS = 'เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น';
const COMPANY_LOCATION = 'เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์-แฟ็กซ์ 02-047-7979';

// Font loader style to be injected
const FontLoader = ({ data }: { data: ManifestWithSignatures }) => (
    <style dangerouslySetInnerHTML={{
        __html: `
        ${data.pdfAssets?.regularFontDataUrl ? `
        @font-face {
            font-family: 'TH Sarabun New';
            src: url('${data.pdfAssets.regularFontDataUrl}') format('truetype');
            font-style: normal;
            font-weight: 400;
        }
        ` : ''}
        ${data.pdfAssets?.boldFontDataUrl ? `
        @font-face {
            font-family: 'TH Sarabun New';
            src: url('${data.pdfAssets.boldFontDataUrl}') format('truetype');
            font-style: normal;
            font-weight: 700;
        }
        ` : ''}
        body, div, span, p, h1, h2, h3, h4, h5, h6, table, td, th, label, strong {
            font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', Arial, sans-serif !important;
        }
        `
    }} />
);

const CompanyHeader = ({ data }: { data: ManifestWithSignatures }) => (
    <div style={{ marginBottom: '12px' }}>
        <div style={{ textAlign: 'center' }}>
            {data.pdfAssets?.logoDataUrl ? (
                <img
                    src={data.pdfAssets.logoDataUrl}
                    alt="Boekfah Group Logo"
                    style={{
                        display: 'block',
                        width: '92px',
                        height: '92px',
                        objectFit: 'contain',
                        margin: '0 auto 8px auto',
                    }}
                />
            ) : null}
            <div style={{ fontSize: '16pt', fontWeight: 'bold', color: '#cc0000', lineHeight: 1.1 }}>{COMPANY_NAME_TH}</div>
            <div style={{ fontSize: '12pt', fontWeight: 'bold', lineHeight: 1.1 }}>{COMPANY_NAME_EN}</div>
            <div style={{ fontSize: '9pt', lineHeight: 1.2 }}>{COMPANY_ADDRESS}</div>
            <div style={{ fontSize: '9pt', lineHeight: 1.2 }}>{COMPANY_LOCATION}</div>
        </div>
        <div style={{ borderBottom: '2px solid black', marginTop: '10px' }} />
    </div>
);

const h1Style: React.CSSProperties = {
    fontSize: '16pt',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: '0 0 5px 0',
};

const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: '2px',
};

const labelStyle: React.CSSProperties = {
    flexShrink: 0,
    marginRight: '5px',
    paddingBottom: '2px',
};

const valueStyle: React.CSSProperties = {
    flexGrow: 1,
    borderBottom: '1px dotted #555',
    minHeight: '18px',
    paddingLeft: '5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.2',
};

const checkRootStyle: React.CSSProperties = {
    marginRight: '10px',
    whiteSpace: 'nowrap',
    display: 'inline-block',
};

const checkStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    border: '1px solid #000',
    marginRight: '3px',
    verticalAlign: 'middle',
    position: 'relative',
    top: '-1px',
    backgroundColor: '#fff',
};

const checkStyleChecked: React.CSSProperties = {
    ...checkStyle,
    textAlign: 'center',
    lineHeight: '10px',
    fontWeight: 'bold',
    fontSize: '10px',
};

const Checkbox = ({ label, checked }: { label: string, checked: boolean }) => (
    <span style={checkRootStyle}>
        <span style={checked ? checkStyleChecked : checkStyle}>
            {checked ? 'X' : '\u00A0'}
        </span>
        <label>{label}</label>
    </span>
);

// --- 1. TEMPLATE: ใบสมัครงาน ---

export const ApplicationFormTemplate = ({ data }: { data: ManifestWithSignatures }) => {
    // Cast to any because structure might be partial/loose in runtime usage
    const app = data.applicant || {} as any;
    const addr = app.currentAddress || {} as any;
    const permAddr = app.permanentAddress ?? ({} as any);
    const emCon = data.applicationDetails?.emergencyContact || {} as any;
    const appDetails = data.applicationDetails || {} as any;
    const vehicle = data.vehicle || {} as any;
    const guarantor = data.guarantor || {} as any;
    const guarantorAddr = guarantor.address || {} as any;

    const vehicleBrand = vehicle.brand === 'other' ? vehicle.brandOther : vehicle.brand;
    const vehicleModel = vehicle.brand === 'other' ? vehicle.modelOther : vehicle.model;
    const vehicleColor = vehicle.color === 'other' ? vehicle.colorOther : vehicle.color;

    // Date Breakdown
    let dobDay = '', dobMonth = '', dobYear = '';
    if (app.dateOfBirth) {
        try {
            const dob = typeof app.dateOfBirth === 'string' ? parseISO(app.dateOfBirth) : app.dateOfBirth;
            dobDay = format(dob, 'd');
            dobMonth = format(dob, 'MMMM', { locale: th });
            dobYear = (parseInt(format(dob, 'yyyy')) + 543).toString();
        } catch { }
    }

    return (
        <div style={pageStyle}>
            <FontLoader data={data} />
            <CompanyHeader data={data} />

            <div style={{ ...h1Style, fontSize: '14pt' }}>ใบสมัครงาน</div>

            {/* Personal Info - Name Row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '2px' }}>
                <div style={{ marginRight: '10px' }}>
                    <Checkbox label="นาย" checked={app.prefix === 'นาย'} />
                    <Checkbox label="นาง" checked={app.prefix === 'นาง'} />
                    <Checkbox label="น.ส." checked={app.prefix === 'นางสาว'} />
                </div>
                <div style={{ ...fieldStyle, flex: 2 }}>
                    <span style={labelStyle}>ชื่อ</span>
                    <span style={valueStyle}>{val(app.firstName)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 2, marginLeft: '5px' }}>
                    <span style={labelStyle}>นามสกุล</span>
                    <span style={valueStyle}>{val(app.lastName)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1, marginLeft: '5px' }}>
                    <span style={labelStyle}>ชื่อเล่น</span>
                    <span style={valueStyle}>{val(app.nickname)}</span>
                </div>
            </div>

            {/* Address Row 1: House - Street (Combined) */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>ที่อยู่ปัจจุบัน</span>
                    <span style={valueStyle}>{val(addr.houseNo)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 0.6 }}>
                    <span style={labelStyle}>หมู่</span>
                    <span style={valueStyle}>{val(addr.moo)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1.5 }}>
                    <span style={labelStyle}>ถนน</span>
                    <span style={valueStyle}>{val(addr.street)}</span>
                </div>
            </div>

            {/* Address Row 2: SubDistrict - Postal Code (Combined) */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 1.2 }}>
                    <span style={labelStyle}>ตําบล/แขวง</span>
                    <span style={valueStyle}>{val(addr.subDistrict)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1.2 }}>
                    <span style={labelStyle}>อําเภอ/เขต</span>
                    <span style={valueStyle}>{val(addr.district)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1.2 }}>
                    <span style={labelStyle}>จังหวัด</span>
                    <span style={valueStyle}>{val(addr.province)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>รหัสไปรษณีย์</span>
                    <span style={valueStyle}>{val(addr.postalCode)}</span>
                </div>
            </div>

            {/* Contact Row: Phone - Email (Combined) */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>โทรศัพท์บ้าน</span>
                    <span style={valueStyle}>{val(app.homePhone)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>มือถือ</span>
                    <span style={valueStyle}>{val(app.mobilePhone)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1.5 }}>
                    <span style={labelStyle}>อีเมล์</span>
                    <span style={valueStyle}>{val(app.email)}</span>
                </div>
            </div>

            {/* ID Card Row: Number - Expiry (Combined) */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 1.5 }}>
                    <span style={labelStyle}>บัตรประชาชนเลขที่</span>
                    <span style={valueStyle}>{val(app.nationalId)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>วันที่ออกบัตร</span>
                    <span style={valueStyle}>{formatDate(app.nationalIdIssueDate)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>วันที่บัตรหมดอายุ</span>
                    <span style={valueStyle}>{formatDate(app.nationalIdExpiryDate)}</span>
                </div>
            </div>

            {/* Personal Details Row */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 1.5 }}>
                    <span style={labelStyle}>เกิดวันที่</span>
                    <span style={valueStyle}>{dobDay} {dobMonth} {dobYear}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 0.8 }}>
                    <span style={labelStyle}>อายุ</span>
                    <span style={valueStyle}>{num(app.age)}</span>
                    <span style={{ marginLeft: '2px' }}>ปี</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>เชื้อชาติ</span>
                    <span style={valueStyle}>{val(app.race)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>สัญชาติ</span>
                    <span style={valueStyle}>{val(app.nationality)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>ศาสนา</span>
                    <span style={valueStyle}>{val(app.religion)}</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                <div style={{ ...fieldStyle, flex: 0.8 }}>
                    <span style={labelStyle}>สูง</span>
                    <span style={valueStyle}>{num(app.height)}</span>
                    <span style={{ marginLeft: '2px' }}>ซม.</span>
                </div>
                <div style={{ ...fieldStyle, flex: 0.8 }}>
                    <span style={labelStyle}>หนัก</span>
                    <span style={valueStyle}>{num(app.weight)}</span>
                    <span style={{ marginLeft: '2px' }}>กก.</span>
                </div>
                <div style={{ ...fieldStyle, flex: 2 }}>
                    <span style={labelStyle}>สถานภาพ:</span>
                    <Checkbox label="โสด" checked={app.maritalStatus === 'single'} />
                    <Checkbox label="แต่งงาน" checked={app.maritalStatus === 'married'} />
                    <Checkbox label="หม้าย" checked={app.maritalStatus === 'widowed'} />
                    <Checkbox label="หย่า" checked={app.maritalStatus === 'divorced'} />
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>ทหาร:</span>
                    <Checkbox label="ผ่าน" checked={app.militaryStatus === 'discharged'} />
                    <Checkbox label="ยังไม่เกณฑ์" checked={app.militaryStatus === 'not-drafted'} />
                </div>
            </div>

            {/* Permanent Address */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2px', marginTop: '4px' }}>
                <div style={{ ...fieldStyle, flex: 2 }}>
                    <span style={labelStyle}>ที่อยู่ตามทะเบียนบ้าน</span>
                    <span style={valueStyle}>{val(permAddr.houseNo)} หมู่ {val(permAddr.moo)} ถ.{val(permAddr.street)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>ตําบล/แขวง</span>
                    <span style={valueStyle}>{val(permAddr.subDistrict)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>อําเภอ/เขต</span>
                    <span style={valueStyle}>{val(permAddr.district)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>จังหวัด</span>
                    <span style={valueStyle}>{val(permAddr.province)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 0.8 }}>
                    <span style={labelStyle}>รหัสปณ.</span>
                    <span style={valueStyle}>{val(permAddr.postalCode)}</span>
                </div>
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'flex-end' }}>
                    <span style={labelStyle}>อาศัยกับ:</span>
                    <Checkbox label="ตนเอง" checked={app.residenceType === 'own'} />
                    <Checkbox label="เช่า" checked={app.residenceType === 'rent'} />
                </div>
            </div>

            {/* Emergency Contact & Criminal & Position */}
            <div style={{ borderTop: '1px dashed #ccc', paddingTop: '5px', marginTop: '5px' }}>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                    <div style={{ ...fieldStyle, flex: 2 }}>
                        <span style={{ ...labelStyle, fontWeight: 'bold' }}>บุคคลติดต่อฉุกเฉิน ชื่อ</span>
                        <span style={valueStyle}>{val(emCon.firstName)} {val(emCon.lastName)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>เกี่ยวข้อง</span>
                        <span style={valueStyle}>{val(emCon.relation)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1.5 }}>
                        <span style={labelStyle}>โทร</span>
                        <span style={valueStyle}>{val(emCon.mobilePhone)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                    <div style={{ ...fieldStyle, flex: 2 }}>
                        <span style={labelStyle}>ตำแหน่งที่สมัคร</span>
                        <span style={valueStyle}>{val(appDetails.position)}</span>
                    </div>
                    <div style={{ flex: 2, display: 'flex', alignItems: 'flex-end' }}>
                        <span style={labelStyle}>เคยต้องโทษคดีอาญา:</span>
                        <Checkbox label="เคย" checked={appDetails.criminalRecord === 'yes'} />
                        <Checkbox label="ไม่เคย" checked={appDetails.criminalRecord === 'no'} />
                    </div>
                </div>
            </div>

            {/* Vehicle Information - Single Row */}
            <div style={{ borderTop: '1px dashed #ccc', paddingTop: '5px', marginTop: '2px' }}>
                <span style={{ ...labelStyle, fontWeight: 'bold' }}>ข้อมูลยานพาหนะ</span>
                <div style={{ display: 'flex', gap: '5px', margin: '2px 0' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ยี่ห้อ</span>
                        <span style={valueStyle}>{val(vehicleBrand)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>รุ่น</span>
                        <span style={valueStyle}>{val(vehicleModel)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 0.8 }}>
                        <span style={labelStyle}>สี</span>
                        <span style={valueStyle}>{val(vehicleColor)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 0.8 }}>
                        <span style={labelStyle}>ปี(ค.ศ.)</span>
                        <span style={valueStyle}>{num(vehicle.year)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ป้ายทะเบียน</span>
                        <span style={valueStyle}>{val(vehicle.plateNo)}</span>
                    </div>
                </div>
            </div>

            {/* Guarantor Information */}
            <div style={{ borderTop: '1px dashed #ccc', paddingTop: '5px', marginTop: '2px' }}>
                <span style={{ ...labelStyle, fontWeight: 'bold' }}>บุคคลค้ำประกัน</span>
                <div style={{ display: 'flex', gap: '5px', margin: '2px 0' }}>
                    <div style={{ ...fieldStyle, flex: 2 }}>
                        <span style={labelStyle}>ชื่อ-สกุล</span>
                        <span style={valueStyle}>{`${val(guarantor.firstName)} ${val(guarantor.lastName)}`.trim()}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1.5 }}>
                        <span style={labelStyle}>เลขบัตร ปชช.</span>
                        <span style={valueStyle}>{val(guarantor.nationalId)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                    <div style={{ ...fieldStyle, flex: 3 }}>
                        <span style={labelStyle}>ที่อยู่</span>
                        <span style={valueStyle}>{val(guarantorAddr.houseNo)} หมู่ {val(guarantorAddr.moo)} ถ.{val(guarantorAddr.street)} แขวง/ตำบล {val(guarantorAddr.subDistrict)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '2px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>เขต/อำเภอ</span>
                        <span style={valueStyle}>{val(guarantorAddr.district)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>จังหวัด</span>
                        <span style={valueStyle}>{val(guarantorAddr.province)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 0.8 }}>
                        <span style={labelStyle}>รหัสปณ.</span>
                        <span style={valueStyle}>{val(guarantorAddr.postalCode)}</span>
                    </div>
                </div>
            </div>

            {/* Declaration & Signature */}
            <div style={{ marginTop: '10px', fontSize: '8pt', borderTop: '2px solid black', paddingTop: '5px' }}>
                <p style={{ margin: '2px 0' }}>ข้าพเจ้าขอสัญญาว่าถ้าได้รับการพิจารณาได้เป็นพนักงานของบริษัทฯจะตั้งใจปฏิบัติหน้าที่อย่างเต็มที่จะซื่อตรง พร้อมทั้งจะรักษาผลประโยชน์ของบริษัททุกกรณี และหวังเป็นอย่างยิ่งว่าจะได้รับการพิจารณารับเข้าทำงาน จึงขอขอบพระคุณมา ณ โอกาสนี้</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                <div style={{ width: '250px', textAlign: 'center' }}>
                    <div style={{ ...fieldStyle, position: 'relative', marginBottom: '2px', justifyContent: 'center', alignItems: 'flex-end' }}>
                        <span style={{ ...labelStyle, position: 'absolute', left: 0, bottom: 0 }}>ลงชื่อ</span>
                        <div style={{ borderBottom: '1px dotted #555', width: '100%', height: '50px', position: 'relative' }}>
                            {/* Signature Image Injection - Centered */}
                            {data.signatures?.applicant && (
                                <img
                                    src={data.signatures.applicant}
                                    style={{
                                        position: 'absolute',
                                        bottom: '0px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        height: '70px',
                                        maxWidth: '200px',
                                        objectFit: 'contain',
                                        zIndex: 10
                                    }}
                                    alt="Applicant Signature"
                                />
                            )}
                        </div>
                        <span style={{ ...labelStyle, marginLeft: '5px' }}>ผู้สมัคร</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '9pt' }}>
                        ( {val(app.prefix)}{val(app.firstName)} {val(app.lastName)} )
                    </div>
                    <div style={{ ...fieldStyle, marginTop: '5px', justifyContent: 'center' }}>
                        <span style={labelStyle}>วันที่</span>
                        <span style={{ ...valueStyle, flexGrow: 0, minWidth: '100px', textAlign: 'center' }}>{formatDate(appDetails.applicationDate)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 2. TEMPLATE: สัญญาจ้างขนส่ง ---

export const TransportContractTemplate = ({ data }: { data: ManifestWithSignatures }) => {
    const app = data.applicant || {} as any;
    const contract = data.contractDetails || {} as any;
    const contractAddr = contract.contactAddress || {} as any;
    const vehicle = data.vehicle || {} as any;

    const vehicleBrand = vehicle.brand === 'other' ? vehicle.brandOther : vehicle.brand;
    const vehicleModel = vehicle.brand === 'other' ? vehicle.modelOther : vehicle.model;
    const vehicleColor = vehicle.color === 'other' ? vehicle.colorOther : vehicle.color;

    return (
        <div style={pageStyle}>
            <FontLoader data={data} />
            <CompanyHeader data={data} />

            <h1 style={{ ...h1Style, marginTop: '20px' }}>สัญญาจ้างขนส่ง</h1>
            <div style={{ marginBottom: '15px' }}>
                <div style={{ ...fieldStyle }}>
                    <span style={labelStyle}>วันที่ทำสัญญา</span>
                    <span style={valueStyle}>{formatDate(contract.contractDate || data.applicationDetails?.applicationDate)}</span>
                </div>
                <div style={{ ...fieldStyle }}>
                    <span style={labelStyle}>ผู้ว่าจ้าง</span>
                    <span style={valueStyle}>บริษัท เบิกฟ้ากรุ๊ป จำกัด</span>
                </div>
                <div style={{ ...fieldStyle }}>
                    <span style={labelStyle}>ผู้รับจ้าง</span>
                    <span style={valueStyle}>{`${val(app.prefix)}${val(app.firstName)} ${val(app.lastName)}`.trim()}</span>
                </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
                <span style={{ ...labelStyle, fontWeight: 'bold', fontSize: '12pt' }}>ข้อมูลติดต่อ</span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>โทรศัพท์</span>
                        <span style={valueStyle}>{val(contract.phone || app.mobilePhone)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>แฟกซ์</span>
                        <span style={valueStyle}>{val(contract.fax)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ที่อยู่ติดต่อ</span>
                        <span style={valueStyle}>{val(contractAddr.houseNo)} หมู่ {val(contractAddr.moo)} ถ.{val(contractAddr.street)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ตำบล/แขวง</span>
                        <span style={valueStyle}>{val(contractAddr.subDistrict)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>อำเภอ/เขต</span>
                        <span style={valueStyle}>{val(contractAddr.district)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>จังหวัด</span>
                        <span style={valueStyle}>{val(contractAddr.province)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>รหัสปณ.</span>
                        <span style={valueStyle}>{val(contractAddr.postalCode)}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
                <span style={{ ...labelStyle, fontWeight: 'bold', fontSize: '12pt' }}>รายละเอียดรถที่ใช้ในการขนส่ง</span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ยี่ห้อ</span>
                        <span style={valueStyle}>{val(vehicleBrand)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>รุ่น</span>
                        <span style={valueStyle}>{val(vehicleModel)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>สี</span>
                        <span style={valueStyle}>{val(vehicleColor)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ปี (ค.ศ.)</span>
                        <span style={valueStyle}>{num(vehicle.year)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ป้ายทะเบียน</span>
                        <span style={valueStyle}>{val(contract.vehiclePlateNo || vehicle.plateNo)}</span>
                    </div>
                </div>
            </div>

            {/* TERMS & CONDITIONS */}
            <div style={{ marginTop: '20px', fontSize: '10pt', lineHeight: '1.5', textAlign: 'justify' }}>
                <p style={{ textIndent: '40px', marginBottom: '10px' }}>
                    สัญญาฉบับนี้ทำขึ้นระหว่าง บริษัท เบิกฟ้ากรุ๊ป จำกัด โดย นายวัชระ บุปผา ตำแหน่ง กรรมการผู้จัดการ ผู้มีอำนาจลงนาม สำนักงานตั้งอยู่เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์ 02-047-7979 โทรสาร 02-047-7979 มือถือ 084-208-6992 ซึ่งต่อไปนี้ในสัญญานี้เรียกว่า "ผู้ว่าจ้าง" ฝ่ายหนึ่ง กับ
                </p>
                <div style={{ textIndent: '40px', marginBottom: '10px' }}>
                    {`${val(app.prefix)}${val(app.firstName)} ${val(app.lastName)}`.trim()} เลขที่บัตรประจำตัวประชาชน {val(app.nationalId)}
                    <br />
                    ที่อยู่เลขที่ {val(contractAddr.houseNo)} หมู่ที่ {val(contractAddr.moo)} ถนน {val(contractAddr.street)} ตำบล {val(contractAddr.subDistrict)} อำเภอ {val(contractAddr.district)} จังหวัด {val(contractAddr.province)} รหัสไปรษณีย์ {val(contractAddr.postalCode)} โทรศัพท์ {val(contract.phone || app.mobilePhone)}
                    <br />
                    ในสัญญานี้เรียกว่า "ผู้รับจ้าง"
                </div>

                <p style={{ marginTop: '10px', marginBottom: '10px' }}>คู่สัญญาได้ตกลงทำสัญญาไว้ต่อกันมีข้อความและเงื่อนไขดังต่อไปนี้</p>

                <div style={{ paddingLeft: '20px', margin: '5px 0' }}>
                    <p style={{ margin: '5px 0' }}><strong>ข้อ 1.</strong> "ผู้ว่าจ้าง" ตกลงจ้าง และ "ผู้รับจ้าง" ตกลงรับจ้างทำการขนส่งสินค้าตามรายละเอียดของสินค้าปรากฏตามใบสั่งของที่ให้ผู้รับจ้างทำการขนส่งในแต่ละครั้ง และให้ถือเอาใบส่งของแต่ละครั้งเป็นส่วนหนึ่งของสัญญาฉบับนี้ด้วย</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 2.</strong> ผู้รับจ้างจะทำการขนส่งสินค้าตามข้อ 1. ด้วยรถยนต์หมายเลขทะเบียน ({val(contract.vehiclePlateNo || vehicle.plateNo)}) ซึ่งเป็นรถยนต์ของผู้รับจ้างเองที่มีกรรมสิทธิ์ และอยู่ในความครอบครองของตนเอง เพื่อนำส่งสินค้าตามที่ผู้ว่าจ้างกำหนดให้ส่งแก่ผู้รับสินค้าในกรุงเทพมหานคร และ/หรือ ต่างจังหวัดทั่วราชอาณาจักร โดยผู้รับจ้างจะต้องส่งให้ถึงผู้รับสินค้าตามวันเวลาและสถานที่ที่ผู้ว่าจ้างกำหนด</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 3.</strong> รถยนต์ที่ใช้บรรทุกสินค้าตามสัญญา ข้อ 2. ผู้รับจ้างจะต้องจัดให้มีคนขับรถ 1 คน ซึ่งจะต้องมีความชำนาญในการขับขี่รถยนต์ตามประเภทของรถยนต์ และรู้เส้นทางเป็นอย่างดี คนขับรถจะต้องไม่ติดยาเสพติด รวมทั้งจะต้องไม่ดื่มเครื่องดื่มที่มีแอลกอฮอล์ผสมอยู่ในขณะขับรถยนต์ และจะต้องมีพนักงานติดรถยนต์อีก 1 คน อยู่ประจำตลอดเวลาที่ทำการขนส่งสินค้าให้แก่ผู้ว่าจ้าง โดยค่าใช้จ่ายต่างๆ ที่เกี่ยวกับการขนส่งสินค้า รวมทั้งค่าจ้างพนักงานติดรถยนต์ ถือเป็นความรับผิดชอบของผู้รับจ้างทั้งหมดทั้งสิ้น</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 4.</strong> ผู้รับจ้างรวมถึงผู้อยู่ในความรับผิดชอบของผู้รับจ้าง ซึ่งเกี่ยวข้องกับรถบรรทุกตามสัญญานี้ มีหน้าที่ต้องปฏิบัติตามกฎระเบียบข้อบังคับและคำสั่งของผู้ว่าจ้างทุกประการ หากฝ่าฝืนและเกิดความเสียหายขึ้น ผู้รับจ้างจะต้องเป็นผู้รับผิดชอบทั้งสิ้น</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 5.</strong> เมื่อสินค้าที่จะทำการขนส่งในแต่ละครั้งได้บรรทุกขึ้นรถยนต์บรรทุกสินค้าของผู้รับจ้างแล้ว ให้สินค้าเหล่านั้นอยู่ในความรับผิดชอบดูแลของผู้รับจ้างทันทีตลอดเวลา จนกว่าผู้รับสินค้าปลายทางจะได้รับสินค้าโดยถูกต้องตามรายการใบส่งของ หากเกิดความเสียหายใดๆ แก่สินค้าที่ขนส่ง หรือชำรุด บุบสลาย หรือสูญหาย ไม่ว่าด้วยเหตุใดก็ตาม หรือไม่ว่าจะเกิดอุบัติเหตุหรือการกระทำโดยประมาทของคนขับรถ และ/หรือ พนักงานติดรถ หรือบุคคลภายนอก หรือเกิดจากการละเมิด หรือก่อให้เกิดความเสียหายแก่ผู้อื่นหรือผู้รับสินค้าปลายทางก็ตาม ผู้รับจ้างจะต้องรับผิดชอบชดใช้เต็มจำนวนราคาสินค้าตามราคาที่ผู้ว่าจ้างได้จัดส่งให้แก่ผู้รับสินค้าปลายทางทั้งสิ้น</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 6.</strong> ในการขนส่งสินค้าตามสัญญานี้ ผู้รับจ้างจะต้องทำการขนส่งด้วยความระมัดระวังตามประเภทของสินค้าที่ขนส่ง เพื่อไม่ก่อให้เกิดความเสียหายแก่สินค้า และจะต้องขนส่งโดยเร็วให้ทันตามกำหนด วัน เวลา และสถานที่ที่ผู้ว่าจ้างกำหนดไว้ในบิลส่งสินค้าเท่านั้น</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 7.</strong> หากเกิดความเสียหายอย่างใดอย่างหนึ่งแก่สินค้าที่ขนส่ง หรือชำรุด หรือสูญหาย ไม่ว่าด้วยเหตุใดก็ตาม ผู้รับจ้างจะต้องแจ้งให้ผู้ว่าจ้างทราบทันทีทุกกรณี</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 8.</strong> ในระหว่างทางที่ทำการขนส่งสินค้าตามสัญญานี้ ผู้รับจ้างห้ามนำสินค้าโยกย้ายหรือสับเปลี่ยนสินค้าออกจากรถยนต์คันที่บรรทุกสินค้าอยู่โดยเด็ดขาด</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 9.</strong> ในกรณีที่ผู้รับจ้างได้เก็บเงินจากลูกค้า ผู้รับจ้างจะต้องรีบนำเงินมาส่งให้ผู้ว่าจ้างโดยทันที มิฉะนั้นถือว่ามีเจตนายักยอกทรัพย์นายจ้าง และจะถูกดำเนินการทางกฎหมายต่อไป</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 10.</strong> ในกรณีที่ผู้รับจ้างต้องการบอกเลิกสัญญา ผู้รับจ้างจะต้องแจ้งให้ผู้ว่าจ้างทราบเป็นลายลักษณ์อักษรล่วงหน้าอย่างน้อย 30 วัน และผู้รับจ้างจะต้องมาปฏิบัติงานทุกวันจนถึงวันเลิกสัญญา หากในระหว่างนี้ผู้รับจ้างขาดงาน ทางผู้ว่าจ้างปรับเป็นเงินวันละ 1,500 บาท / ต่อวัน จนครบ 30 วัน</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 11.</strong> ในกรณีที่ผู้รับจ้างบอกเลิกสัญญากะทันหันโดยไม่ได้แจ้งให้ผู้ว่าจ้างทราบล่วงหน้าอย่างน้อย 30 วัน ผู้ว่าจ้างจะทำการปรับเงิน 1,500 บาท / ต่อวัน จนครบ 30 วัน</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 12.</strong> ผู้ว่าจ้างจะจ่ายค่าขนส่งตามหนังสือประกาศอัตราจ่ายแต่ละประเภทของการบรรทุกสินค้า โดยตัดบัญชีเดือนต่อเดือนทุกสิ้นเดือน และจะจ่ายให้แล้วเสร็จภายในวันที่ 10 หรือวันที่ 25 ของวันถัดไปตามตกลง</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 13.</strong> เมื่อผู้ว่าจ้างได้ส่งหนังสือถึงผู้รับจ้างเพื่อแจ้งให้ผู้รับจ้างทราบ หรือให้กระทำการใดๆ ตามสัญญานี้ หรือบอกเลิกสัญญา ให้ผู้ว่าจ้างส่งหนังสือถึงผู้รับจ้างทางไปรษณีย์ตอบรับส่งถึงผู้รับจ้างตามที่ระบุไว้ในสัญญานี้ แล้วให้ถือว่าผู้ว่าจ้างได้ส่งให้แก่ผู้รับจ้างโดยชอบแล้ว</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 14.</strong> ในกรณีที่ผู้รับจ้างลาออก ทางผู้ว่าจ้างยังไม่จ่ายค่าบรรทุกสินค้าในเดือนที่ลาออกนั้น จนกว่าผู้รับจ้างจะชดใช้ค่าเสียหายและค่าใช้จ่ายอื่นๆ ที่เกิดขึ้นที่มีต่อผู้ว่าจ้างจนครบจบสิ้น</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อ 15.</strong> ถ้าในกรณีผู้รับจ้างได้ทำสินค้าเสียหายชำรุด หรือสูญหาย แล้วขาดการติดต่อจากผู้รับจ้าง ไม่ว่าในกรณีใดๆ ทั้งสิ้น ทางผู้ว่าจ้างจะถือว่าทางผู้รับจ้างตั้งใจทุจริตหรือก่อการลักทรัพย์โดยเจตนา ผู้ว่าจ้างจึงจำเป็นต้องดำเนินคดีตามกฎหมายให้ถึงที่สุด</p>
                </div>

                <p style={{ marginTop: '20px', textAlign: 'center' }}><strong>ใจความในสัญญาแล้วเห็นว่าถูกต้องตรงตามเจตนาของคู่สัญญาทั้งสองฝ่าย จึงลงลายมือชื่อไว้ตรงต่อหน้าพยาน</strong></p>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', padding: '0 20px' }}>
                <div style={{ width: '250px', textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px dotted #555', height: '30px', marginBottom: '5px' }}></div>
                    <span>ลงชื่อ...................................................ผู้ว่าจ้าง</span><br />
                    <span>( บริษัท เบิกฟ้ากรุ๊ป จำกัด )</span>
                </div>
                <div style={{ width: '250px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', height: '50px', borderBottom: '1px dotted #555', marginBottom: '5px' }}>
                        {data.signatures?.applicant && (
                            <img
                                src={data.signatures.applicant}
                                style={{
                                    position: 'absolute',
                                    bottom: '0px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    height: '70px',
                                    maxWidth: '200px',
                                    objectFit: 'contain',
                                    zIndex: 10
                                }}
                                alt="Signature"
                            />
                        )}
                    </div>
                    <span>ลงชื่อ...................................................ผู้รับจ้าง</span><br />
                    <span>( {val(app.firstName)} {val(app.lastName)} )</span>
                </div>
            </div>
        </div>
    );
};

// --- 3. TEMPLATE: สัญญาค้ำประกัน ---

export const GuaranteeContractTemplate = ({ data }: { data: ManifestWithSignatures }) => {
    const guarantor = data.guarantor || {} as any;
    const guarantorAddr = guarantor.address || {} as any;
    const applicant = data.applicant || {} as any;

    return (
        <div style={pageStyle}>
            <FontLoader data={data} />
            <CompanyHeader data={data} />

            <h1 style={{ ...h1Style, marginTop: '20px' }}>สัญญาค้ำประกันบุคคลเข้าทำงาน</h1>
            <div style={{ ...fieldStyle }}>
                <span style={labelStyle}>วันที่ทำสัญญา</span>
                <span style={valueStyle}>{formatDate(guarantor.contractDate || data.applicationDetails?.applicationDate)}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <div style={{ ...fieldStyle, flex: 1.5 }}>
                    <span style={labelStyle}>ข้าพเจ้า (ผู้ค้ำประกัน)</span>
                    <span style={valueStyle}>{`${val(guarantor.firstName)} ${val(guarantor.lastName)}`.trim()}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>เลขบัตรประชาชน</span>
                    <span style={valueStyle}>{val(guarantor.nationalId)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 0.5 }}>
                    <span style={labelStyle}>อายุ</span>
                    <span style={valueStyle}>{num(guarantor.age)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>เชื้อชาติ</span>
                    <span style={valueStyle}>{val(guarantor.race)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>สัญชาติ</span>
                    <span style={valueStyle}>{val(guarantor.nationality)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 2 }}>
                    <span style={labelStyle}>อาชีพ</span>
                    <span style={valueStyle}>{val(guarantor.occupation)}</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <span style={labelStyle}>เบอร์โทรศัพท์</span>
                    <span style={valueStyle}>{val(guarantor.phone)}</span>
                </div>
                <div style={{ ...fieldStyle, flex: 2 }}>
                    <span style={labelStyle}>สถานที่ทำงาน</span>
                    <span style={valueStyle}>{'-'}</span>
                </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
                <span style={{ ...labelStyle, fontWeight: 'bold', fontSize: '12pt' }}>ที่อยู่ผู้ค้ำประกัน</span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>บ้านเลขที่</span>
                        <span style={valueStyle}>{val(guarantorAddr.houseNo)} หมู่ {val(guarantorAddr.moo)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ถนน</span>
                        <span style={valueStyle}>{val(guarantorAddr.street)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>ตำบล/แขวง</span>
                        <span style={valueStyle}>{val(guarantorAddr.subDistrict)}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>อำเภอ/เขต</span>
                        <span style={valueStyle}>{val(guarantorAddr.district)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>จังหวัด</span>
                        <span style={valueStyle}>{val(guarantorAddr.province)}</span>
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                        <span style={labelStyle}>รหัสไปรษณีย์</span>
                        <span style={valueStyle}>{val(guarantorAddr.postalCode)}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '15px' }}>
                <div style={{ ...fieldStyle }}>
                    <span style={labelStyle}>ตกลงทำสัญญาค้ำประกันให้แก่ (ผู้สมัคร)</span>
                    <span style={valueStyle}>{`${val(applicant.prefix)}${val(applicant.firstName)} ${val(applicant.lastName)}`.trim()}</span>
                </div>
                <div style={{ ...fieldStyle }}>
                    <span style={labelStyle}>ตำแหน่ง</span>
                    <span style={valueStyle}>{val(data.applicationDetails?.position)}</span>
                </div>
            </div>

            {/* TERMS & CONDITIONS */}
            <div style={{ marginTop: '20px', fontSize: '10pt', lineHeight: '1.5', textAlign: 'justify' }}>
                <p style={{ textIndent: '40px', marginBottom: '10px' }}>
                    ข้าพเจ้า {val(guarantor.firstName)} {val(guarantor.lastName)} อายุ {num(guarantor.age)} ปี เชื้อชาติ {val(guarantor.race)} สัญชาติ {val(guarantor.nationality)} อยู่บ้านเลขที่ {val(guarantorAddr.houseNo)} หมู่ที่ {val(guarantorAddr.moo)} ถนน {val(guarantorAddr.street)} ตำบล/แขวง {val(guarantorAddr.subDistrict)} อำเภอ/เขต {val(guarantorAddr.district)} จังหวัด {val(guarantorAddr.province)} รหัสไปรษณีย์ {val(guarantorAddr.postalCode)} ถือบัตรประจำตัวประชาชนเลขที่ {val(guarantor.nationalId)} ซึ่งต่อไปในสัญญานี้เรียกว่า "ผู้ค้ำประกัน" ขอทำหนังสือสัญญาค้ำประกันฉบับนี้ไว้กับ บริษัท เบิกฟ้ากรุ๊ป จำกัด ซึ่งต่อไปในสัญญาจะเรียกว่า "บริษัท" มีข้อความดังนี้
                </p>

                <div style={{ paddingLeft: '20px', margin: '5px 0' }}>
                    <p style={{ margin: '5px 0' }}><strong>ข้อที่ 1.</strong> ตามที่บริษัทได้ตกลงรับผู้รับจ้างชื่อ {`${val(applicant.prefix)}${val(applicant.firstName)} ${val(applicant.lastName)}`.trim()} อายุ {num(applicant.age)} ปี เชื้อชาติ {val(applicant.race)} สัญชาติ {val(applicant.nationality)} อยู่บ้านเลขที่ {val(applicant.currentAddress?.houseNo)} เข้าทำงานในบริษัทตั้งแต่วันที่ {formatDate(guarantor.applicantStartDate || data.applicationDetails?.applicationDate)} ถ้าหากได้ก่อให้เกิดหนี้สินขึ้นแก่บริษัทหรือกระทำการใดๆ อันก่อให้เกิดความเสียหายขึ้นแก่บริษัท ข้าพเจ้าในฐานะผู้ค้ำประกันยอมรับผิดชอบหนี้สินและค่าเสียหายทั้งหมดเต็มจำนวนที่เกิดความเสียหายของสินค้านั้นให้แก่ บริษัท เบิกฟ้ากรุ๊ป จำกัด ทันทีโดยไม่อ้างเหตุใดๆ มาปัดความรับผิดชอบเป็นอันขาด</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อที่ 2.</strong> ในกรณีที่บริษัทเรียกร้องให้ข้าพเจ้าในฐานะผู้ค้ำประกันรับผิดชอบชดใช้หนี้สินหรือค่าเสียหายดังกล่าวแล้ว ข้าพเจ้าผู้ค้ำประกันยอมสละสิทธิในอันที่จะขอให้บริษัทเรียกร้องเอาจากผู้รับจ้างก่อน โดยผู้ค้ำประกันจะได้รู้เห็นยินยอมหรือไม่ก็ตาม ผู้ค้ำประกันจะไม่อ้างเอาการผ่อนเวลาเช่นว่านั้นเป็นเหตุปลดเปลื้องความรับผิดชอบตามสัญญาค้ำประกัน</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อที่ 3.</strong> สัญญาค้ำประกันฉบับนี้ผู้ค้ำประกันตกลงยินยอมค้ำประกันให้ผู้รับจ้างตลอดระหว่างที่ทำงานอยู่กับบริษัท</p>

                    <p style={{ margin: '5px 0' }}><strong>ข้อที่ 4.</strong> ในกรณีผู้ค้ำประกันประสงค์ที่จะบอกเลิกสัญญาค้ำประกันหรือถอนการค้ำประกันนี้ ผู้ค้ำประกันจะต้องแจ้งให้ทางบริษัททราบล่วงหน้าเป็นลายลักษณ์อักษรอย่างน้อย 30 วัน</p>
                </div>

                <p style={{ marginTop: '20px', textAlign: 'center' }}><strong>ข้าพเจ้าผู้ค้ำประกันได้อ่านและเข้าใจข้อความในสัญญาค้ำประกันฉบับนี้โดยตลอดแล้วเห็นว่าถูกต้อง จึงได้ลงลายมือชื่อไว้กับบริษัทและพยานไว้เป็นสำคัญ</strong></p>
            </div>

            {/* Guarantor Signature Section - CENTERED */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', paddingRight: '20px' }}>
                <div style={{ width: '280px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', height: '50px', borderBottom: '1px dotted #555', marginBottom: '5px' }}>
                        {data.signatures?.guarantor && (
                            <img
                                src={data.signatures.guarantor}
                                style={{
                                    position: 'absolute',
                                    bottom: '0px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    height: '70px',
                                    maxWidth: '200px',
                                    objectFit: 'contain',
                                    zIndex: 10
                                }}
                                alt="Guarantor Signature"
                            />
                        )}
                    </div>
                    <span>ลงชื่อ...................................................ผู้ค้ำประกัน</span><br />
                    <span>( {val(guarantor.firstName)} {val(guarantor.lastName)} )</span>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px', paddingLeft: '20px' }}>
                <div style={{ width: '250px', textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px dotted #555', height: '30px', marginBottom: '5px' }}></div>
                    <span>ลงชื่อ...................................................พยาน</span><br />
                    <span>( ................................................... )</span>
                </div>
            </div>
        </div>
    );
};
