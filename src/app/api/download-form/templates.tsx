/**
 * src/app/api/download-form/templates.tsx
 * * This file contains React components used as HTML templates for PDF generation.
 * These components are rendered to a static string by 'react-dom/server'
 * and then sent to the PDF generation service (e.g., Google Apps Script).
 */

// Import React and Manifest types
import React from 'react';
// We need to define or import the 'Manifest' type here for props.
// Let's define a minimal one based on usage.
type Manifest = {
  applicant?: {
    prefix?: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    currentAddress?: {
      houseNo?: string;
      moo?: string;
      street?: string;
      subDistrict?: string;
      district?: string;
      province?: string;
      postalCode?: string;
    };
    homePhone?: string;
    mobilePhone?: string;
    email?: string;
    permanentAddress?: {
      houseNo?: string;
      moo?: string;
      street?: string;
      subDistrict?: string;
      district?: string;
      province?: string;
      postalCode?: string;
    };
    residenceType?: string;
    dateOfBirth?: string | Date;
    age?: number;
    race?: string;
    nationality?: string;
    religion?: string;
    nationalId?: string;
    nationalIdIssueDate?: string | Date;
    nationalIdExpiryDate?: string | Date;
    height?: number;
    weight?: number;
    militaryStatus?: string;
    maritalStatus?: string;
    gender?: string;
  };
  applicationDetails?: {
    applicationDate?: string | Date;
    position?: string;
    criminalRecord?: string;
    emergencyContact?: {
      firstName?: string;
      lastName?: string;
      occupation?: string;
      relation?: string;
      mobilePhone?: string;
    };
  };
  guarantor?: {
    firstName?: string;
    lastName?: string;
    contractDate?: string | Date;
    address?: {
        houseNo?: string;
        moo?: string;
        street?: string;
        subDistrict?: string;
        district?: string;
        province?: string;
        postalCode?: string;
    };
    nationalId?: string;
  };
  contractDetails?: {
      contractDate?: string | Date;
  };
  vehicle?: {
      plateNo?: string;
  };
};

// --- Helper Components ---

/**
 * Helper to safely format dates.
 * Note: date-fns/th locale is not available here, so we format simply.
 */
function formatDate(date: string | Date | undefined): string {
    if (!date) return '..............................';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${dd} / ${mm} / ${yyyy}`;
    } catch {
        return '..............................';
    }
}

/**
 * Helper for optional string/number values
 */
const val = (text: string | number | undefined | null) => (text || '');

// *** FIX 1: Define props for Checkbox ***
type CheckboxProps = {
  checked?: boolean;
  style?: React.CSSProperties; // Allow style prop
};

/**
 * Helper for checkbox
 */
const Checkbox = ({ checked = false, style = {} }: CheckboxProps) => ( // Apply props
  <span style={{
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '1px solid #000',
    marginRight: '5px',
    verticalAlign: 'middle',
    textAlign: 'center',
    lineHeight: '12px',
    fontFamily: 'Helvetica, sans-serif', // Use a font that has 'X'
    ...style // Merge passed-in style (e.g., marginLeft)
  }}>
    {checked ? 'X' : '\u00A0'}
  </span>
);

// *** FIX 2: Define props for Field ***
type FieldProps = {
  label: string;
  value: string | number | undefined | null;
  labelWidth?: string;
  fieldWidth?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
};

/**
 * Helper for a labeled field with an underline
 */
const Field = ({ 
  label, 
  value, 
  labelWidth = 'auto', 
  fieldWidth = '100px', 
  fullWidth = false, 
  style = {} 
}: FieldProps) => ( // Apply props
  <div style={{ 
    display: fullWidth ? 'block' : 'inline-block', 
    marginRight: '15px', 
    marginBottom: '10px',
    ...style 
  }}>
    <span>{label}</span>
    <span style={{
      display: 'inline-block',
      width: fieldWidth,
      borderBottom: '1px solid #999',
      paddingLeft: '5px',
      marginLeft: labelWidth === 'auto' ? '5px' : labelWidth,
      fontFamily: 'Helvetica, sans-serif', // Ensure value font is set
      color: '#000',
    }}>
      {val(value) || '\u00A0'}
    </span>
  </div>
);

// --- Main PDF Templates ---

/**
 * 1. Application Form Template
 */
export const ApplicationFormTemplate = ({ data }: { data: Manifest }) => {
  const app = data.applicant || {};
  const appDetails = data.applicationDetails || {};
  const currentAddr = app.currentAddress || {};
  const permAddr = app.permanentAddress || {};
  const emCon = appDetails.emergencyContact || {};

  // Date formatting
  const dob = app.dateOfBirth ? new Date(app.dateOfBirth) : null;
  const dobDay = dob ? dob.getDate() : '';
  const dobMonth = dob ? dob.getMonth() + 1 : ''; // Using number as locale is complex here
  const dobYear = dob ? dob.getFullYear() : ''; // Using A.D. for simplicity

  return (
    <html lang="th">
      <head>
        <meta charSet="UTF-8" />
        <title>ใบสมัครงาน</title>
        {/* We must inline all styles. CSS <link> won't work. */}
        <style>{`
          body {
            font-family: 'Sarabun', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10pt;
            color: #000;
            margin: 0;
            padding: 0;
          }
          .page {
            width: 210mm; /* A4 width */
            min-height: 297mm; /* A4 height */
            padding: 20mm;
            box-sizing: border-box;
            background: #fff;
          }
          .header {
            margin-bottom: 10px;
          }
          .header h1 {
            font-size: 14pt;
            margin: 0;
          }
          .header p {
            font-size: 10pt;
            margin: 2px 0;
          }
          .title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin: 20px 0;
          }
          .section {
            margin-bottom: 15px;
          }
          .checkbox-group {
            margin-bottom: 15px;
          }
          .field-group {
            width: 100%;
            display: block;
          }
          .declaration {
            font-size: 8pt;
            margin: 20px 0;
          }
          .signature-area {
            margin-top: 40px;
            text-align: right;
          }
          .signature-field {
            width: 250px; 
            display: inline-block; 
            text-align: center;
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          <div className="header">
            <h1>บริษัทเบิกฟ้ากรุ๊ปจำกัด</h1>
            <p>เลขที่ 202/357 ซอยเคหะร่มเกล้า 27 ถนนเคหะร่มเกล้า แขวงคลองสองต้นนุ่น</p>
            <p>เขตลาดกระบัง กรุงเทพมหานคร 10520 โทรศัพท์-แฟ็กซ์ 02-047-7979</p>
          </div>

          <div className="title">ใบสมัครงาน</div>

          <div className="section checkbox-group">
            <Checkbox checked={app.prefix === 'นาย'} /> นาย
            <Checkbox checked={app.prefix === 'นาง'} style={{ marginLeft: '15px' }} /> นาง
            <Checkbox checked={app.prefix === 'นางสาว'} style={{ marginLeft: '15px' }} /> นางสาว
            <Field label="ชื่อ" value={app.firstName} labelWidth="80px" fieldWidth="150px" style={{ marginLeft: '20px' }} />
            <Field label="นามสกุล" value={app.lastName} labelWidth="50px" fieldWidth="150px" />
            <Field label="ชื่อเล่น" value={app.nickname} labelWidth="auto" fieldWidth="150px" style={{ float: 'right' }} />
          </div>

          <div className="section">
            <div className="field-group">
              <Field label="ที่อยู่ปัจจุบันบ้านเลขที่" value={currentAddr.houseNo} labelWidth="120px" fieldWidth="100px" />
              <Field label="หมู่ที่" value={currentAddr.moo} labelWidth="30px" fieldWidth="80px" />
              <Field label="ถนน" value={currentAddr.street} labelWidth="30px" fieldWidth="150px" />
            </div>
            <div className="field-group">
              <Field label="ตำบล/แขวง" value={currentAddr.subDistrict} labelWidth="60px" fieldWidth="160px" />
              <Field label="อำเภอ/เขต" value={currentAddr.district} labelWidth="60px" fieldWidth="160px" />
            </div>
            <div className="field-group">
              <Field label="จังหวัด" value={currentAddr.province} labelWidth="60px" fieldWidth="160px" />
              <Field label="รหัสไปรษณีย์" value={currentAddr.postalCode} labelWidth="70px" fieldWidth="150px" />
            </div>
            <div className="field-group">
              <Field label="โทรศัพท์" value={app.homePhone} labelWidth="60px" fieldWidth="160px" />
              <Field label="มือถือ" value={app.mobilePhone} labelWidth="40px" fieldWidth="180px" />
            </div>
            <Field label="อีเมล์" value={app.email} labelWidth="60px" fieldWidth="400px" fullWidth={true} />
          </div>

          <div className="section">
            <div className="field-group">
              <Field label="ที่อยู่ตามทะเบียนบ้านเลขที่" value={permAddr.houseNo} labelWidth="140px" fieldWidth="80px" />
              <Field label="หมู่ที่" value={permAddr.moo} labelWidth="30px" fieldWidth="80px" />
              <Field label="ถนน" value={permAddr.street} labelWidth="30px" fieldWidth="150px" />
            </div>
            <div className="field-group">
              <Field label="ตำบล/แขวง" value={permAddr.subDistrict} labelWidth="60px" fieldWidth="160px" />
              <Field label="อำเภอ/เขต" value={permAddr.district} labelWidth="60px" fieldWidth="160px" />
            </div>
            <div className="field-group">
              <Field label="จังหวัด" value={permAddr.province} labelWidth="60px" fieldWidth="160px" />
              <Field label="รหัสไปรษณีย์" value={permAddr.postalCode} labelWidth="70px" fieldWidth="150px" />
            </div>
          </div>
          
          <div className="section checkbox-group">
            อาศัยอยู่กับ
            <Checkbox checked={app.residenceType === 'own'} style={{ marginLeft: '15px' }} /> บ้านตัวเอง
            <Checkbox checked={app.residenceType === 'rent'} style={{ marginLeft: '15px' }} /> บ้านเช่า
            <Checkbox checked={app.residenceType === 'dorm'} style={{ marginLeft: '15px' }} /> หอพัก
          </div>

          <div className="section">
            <div className="field-group">
              <Field label="เกิดวันที่" value={dobDay} labelWidth="50px" fieldWidth="50px" />
              <Field label="เดือน" value={dobMonth} labelWidth="30px" fieldWidth="100px" />
              <Field label="พ.ศ." value={dobYear} labelWidth="30px" fieldWidth="60px" />
              <Field label="อายุ" value={app.age} labelWidth="30px" fieldWidth="40px" /> ปี
            </div>
            <div className="field-group">
              <Field label="เชื้อชาติ" value={app.race} labelWidth="50px" fieldWidth="100px" />
              <Field label="สัญชาติ" value={app.nationality} labelWidth="50px" fieldWidth="100px" />
              <Field label="ศาสนา" value={app.religion} labelWidth="50px" fieldWidth="100px" />
            </div>
            <Field label="บัตรประชาชนเลขที่" value={app.nationalId} labelWidth="100px" fieldWidth="200px" fullWidth={true} />
            <div className="field-group">
              <Field label="วันที่ออกบัตร" value={formatDate(app.nationalIdIssueDate)} labelWidth="80px" fieldWidth="150px" />
              <Field label="วันที่บัตรหมดอายุ" value={formatDate(app.nationalIdExpiryDate)} labelWidth="100px" fieldWidth="150px" />
            </div>
            <div className="field-group">
              <Field label="ส่วนสูง" value={app.height} labelWidth="50px" fieldWidth="50px" /> ซม.
              <Field label="น้ำหนัก" value={app.weight} labelWidth="50px" fieldWidth="50px" style={{ marginLeft: '15px' }} /> กก.
            </div>
          </div>

          <div className="section">
            <div className="checkbox-group">
              ภาวะทางทหาร
              <Checkbox checked={app.militaryStatus === 'exempt'} style={{ marginLeft: '10px' }} /> ยกเว้น
              <Checkbox checked={app.militaryStatus === 'discharged'} style={{ marginLeft: '10px' }} /> ปลดเป็นทหารกองหนุน
              <Checkbox checked={app.militaryStatus === 'not-drafted'} style={{ marginLeft: '10px' }} /> ยังไม่ได้รับการเกณฑ์
            </div>
            <div className="checkbox-group">
              สถานภาพ
              <Checkbox checked={app.maritalStatus === 'single'} style={{ marginLeft: '10px' }} /> โสด
              <Checkbox checked={app.maritalStatus === 'married'} style={{ marginLeft: '10px' }} /> แต่งงาน
              <Checkbox checked={app.maritalStatus === 'widowed'} style={{ marginLeft: '10px' }} /> หม้าย
              <Checkbox checked={app.maritalStatus === 'divorced'} style={{ marginLeft: '10px' }} /> หย่าร้าง
              <span style={{ marginLeft: '30px' }}>เพศ</span>
              <Checkbox checked={app.gender === 'female'} style={{ marginLeft: '10px' }} /> หญิง
              <Checkbox checked={app.gender === 'male'} style={{ marginLeft: '10px' }} /> ชาย
            </div>
          </div>
          
          <div className="section">
            บุคคลที่ติดต่อได้กรณีฉุกเฉิน
            <div className="field-group" style={{ marginTop: '10px' }}>
              <Field label="ชื่อ" value={emCon.firstName} labelWidth="30px" fieldWidth="150px" />
              <Field label="นามสกุล" value={emCon.lastName} labelWidth="50px" fieldWidth="150px" />
              <Field label="อาชีพ" value={emCon.occupation} labelWidth="40px" fieldWidth="120px" />
            </div>
            <div className="field-group">
              <Field label="เกี่ยวข้องเป็น" value={emCon.relation} labelWidth="70px" fieldWidth="110px" />
              <Field label="มือถือ" value={emCon.mobilePhone} labelWidth="40px" fieldWidth="150px" />
            </div>
          </div>

          <div className="section">
            <Field label="ตำแหน่งที่ต้องการสมัคร" value={appDetails.position} labelWidth="130px" fieldWidth="250px" fullWidth={true} />
            <div className="checkbox-group" style={{ marginTop: '10px' }}>
              เคยต้องโทษทางคดีอาญาหรือไม่
              <Checkbox checked={appDetails.criminalRecord === 'yes'} style={{ marginLeft: '10px' }} /> เคย
              <Checkbox checked={appDetails.criminalRecord === 'no'} style={{ marginLeft: '10px' }} /> ไม่เคย
            </div>
          </div>

          <div className="declaration">
            <p>ข้าพเจ้าขอสัญญาว่าถ้าได้รับการพิจารณาได้เป็นพนักงานของบริษัทฯจะตั้งใจปฏิบัติหน้าที่อย่างเต็มที่จะซื่อตรง พร้อมทั้งจะรักษาผลประโยชน์ของบริษัททุกกรณี และหวังเป็นอย่างยิ่งว่าจะได้รับการพิจารณารับเข้าทำงาน จึงขอขอบพระคุณมา ณ โอกาสนี้</p>
          </div>

          <div className="signature-area">
            <div className="signature-field">
              <Field label="ลงชื่อ" value="" labelWidth="40px" fieldWidth="150px" /> ผู้สมัคร
              <p style={{ marginTop: '5px' }}>( {`${val(app.firstName)} ${val(app.lastName)}`} )</p>
            </div>
            <div className="signature-field" style={{ marginTop: '10px' }}>
              <Field label="ลงวันที่สมัครงาน" value={formatDate(appDetails.applicationDate)} labelWidth="80px" fieldWidth="150px" />
            </div>
          </div>

        </div>
      </body>
    </html>
  );
};

/**
 * 2. Transport Contract Template
 */
export const TransportContractTemplate = ({ data }: { data: Manifest }) => (
  <html lang="th">
    <head>
      <meta charSet="UTF-8" />
      <title>สัญญาจ้างขนส่ง</title>
      <style>{`
        body { font-family: 'Sarabun', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12pt; margin: 25mm; }
        h1 { text-align: center; font-size: 16pt; }
        p { line-height: 1.6; }
      `}</style>
    </head>
    <body>
      <h1>สัญญาจ้างขนส่ง</h1>
      <p>วันที่ทำสัญญา: {formatDate(data.contractDetails?.contractDate || new Date())}</p>
      <br />
      <p>ผู้ว่าจ้าง: บริษัท ไดร์ฟออนบอร์ด จำกัด</p>
      <p>ผู้รับจ้าง (พนักงานขับรถ): {`${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`}</p>
      <p>ที่อยู่: {`${val(data.applicant?.currentAddress?.houseNo)} ${val(data.applicant?.currentAddress?.moo)} ${val(data.applicant?.currentAddress?.subDistrict)} ${val(data.applicant?.currentAddress?.district)} ${val(data.applicant?.currentAddress?.province)}`}</p>
      <p>เลขบัตรประชาชน: {val(data.applicant?.nationalId)}</p>
      <p>รถยนต์ที่ใช้: {val(data.vehicle?.plateNo)}</p>
    </body>
  </html>
);

/**
 * 3. Guarantee Contract Template
 */
export const GuaranteeContractTemplate = ({ data }: { data: Manifest }) => (
  <html lang="th">
    <head>
      <meta charSet="UTF-8" />
      <title>สัญญาค้ำประกันการทำงาน</title>
      <style>{`
        body { font-family: 'Sarabun', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12pt; margin: 25mm; }
        h1 { text-align: center; font-size: 16pt; }
        p { line-height: 1.6; }
      `}</style>
    </head>
    <body>
      <h1>สัญญาค้ำประกันการทำงาน</h1>
      <p>วันที่ทำสัญญา: {formatDate(data.guarantor?.contractDate || new Date())}</p>
      <br />
      <p>ผู้ค้ำประกัน: {`${val(data.guarantor?.firstName)} ${val(data.guarantor?.lastName)}`}</p>
      <p>ที่อยู่ผู้ค้ำประกัน: {`${val(data.guarantor?.address?.houseNo)} ${val(data.guarantor?.address?.moo)} ${val(data.guarantor?.address?.subDistrict)} ${val(data.guarantor?.address?.district)} ${val(data.guarantor?.address?.province)}`}</p>
      <p>เลขบัตรประชาชนผู้ค้ำประกัน: {val(data.guarantor?.nationalId)}</p>
      <br />
      <p>ตกลงค้ำประกัน: {`${val(data.applicant?.prefix)}${val(data.applicant?.firstName)} ${val(data.applicant?.lastName)}`}</p>
      <p>ซึ่งเป็นพนักงานของ บริษัท ไดร์ฟออนบอร์ด จำกัด</p>
    </body>
  </html>
);

