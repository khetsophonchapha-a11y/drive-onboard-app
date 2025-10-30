export const applicationFormSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'แบบฟอร์มสมัครพนักงานขับรถ',
  type: 'object',
  properties: {
    applicant: {
      type: 'object',
      properties: {
        prefix: { type: 'string', description: 'คำนำหน้าชื่อ', enum: ['นาย', 'นาง', 'นางสาว'] },
        firstName: { type: 'string', description: "ชื่อ" },
        lastName: { type: 'string', description: "นามสกุล" },
        nickname: { type: 'string', description: 'ชื่อเล่น' },
        nationalId: { type: 'string', description: 'เลขที่บัตรประจำตัวประชาชน' },
        nationalIdIssueDate: { type: 'string', format: 'date', description: 'วันที่ออกบัตร' },
        nationalIdExpiryDate: { type: 'string', format: 'date', description: 'วันที่บัตรหมดอายุ' },
        dateOfBirth: { type: 'string', format: 'date', description: "วัน/เดือน/ปีเกิด" },
        age: { type: 'integer', description: 'อายุ' },
        race: { type: 'string', description: 'เชื้อชาติ' },
        nationality: { type: 'string', description: 'สัญชาติ' },
        religion: { type: 'string', description: 'ศาสนา' },
        height: { type: 'number', description: 'ส่วนสูง (ซม.)' },
        weight: { type: 'number', description: 'น้ำหนัก (กก.)' },
        gender: { type: 'string', enum: ['ชาย', 'หญิง'], description: 'เพศ' },
        maritalStatus: { type: 'string', enum: ['โสด', 'แต่งงาน', 'หม้าย', 'หย่าร้าง'], description: 'สถานภาพ' },
        currentAddress: { type: 'string', description: 'ที่อยู่ปัจจุบัน' },
        permanentAddress: { type: 'string', description: 'ที่อยู่ตามทะเบียนบ้าน' },
        homePhone: { type: 'string', description: 'โทรศัพท์ (บ้าน)' },
        mobilePhone: { type: 'string', description: 'มือถือ' },
        email: { type: 'string', format: 'email', description: "อีเมล" },
        residenceType: { type: 'string', enum: ['บ้านตัวเอง', 'บ้านเช่า', 'หอพัก'], description: 'ประเภทที่พักอาศัย' },
        militaryStatus: { type: 'string', enum: ['ยกเว้น', 'ปลดเป็นทหารกองหนุน', 'ยังไม่ได้รับการเกณฑ์'], description: 'ภาวะทางทหาร' },
      },
      required: ['prefix', 'firstName', 'lastName', 'nationalId', 'dateOfBirth', 'mobilePhone'],
    },
    applicationDetails: {
        type: 'object',
        properties: {
            position: { type: 'string', description: 'ตำแหน่งที่ต้องการสมัคร' },
            criminalRecord: { type: 'boolean', description: 'ประวัติอาชญากรรม' },
            emergencyContact: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'ชื่อ' },
                    relation: { type: 'string', description: 'ความเกี่ยวข้อง' },
                    phone: { type: 'string', description: 'โทรศัพท์' },
                },
                required: ['name', 'relation', 'phone']
            },
            applicationDate: { type: 'string', format: 'date', description: 'วันที่สมัครงาน' },
        },
        required: ['position', 'applicationDate']
    },
    contractDetails: {
        type: 'object',
        properties: {
            contractDate: { type: 'string', format: 'date', description: 'วันที่ทำสัญญา' },
            vehiclePlateNo: { type: 'string', description: 'หมายเลขทะเบียนรถยนต์' },
        },
        required: ['contractDate']
    },
    guarantor: {
      type: 'object',
      properties: {
        contractDate: { type: 'string', format: 'date', description: 'วันที่ทำสัญญาค้ำประกัน' },
        fullName: { type: 'string', description: "ชื่อ-นามสกุล ผู้ค้ำ" },
        age: { type: 'integer', description: 'อายุ' },
        nationalId: { type: 'string', description: 'เลขที่บัตรประจำตัวประชาชน' },
        address: { type: 'string', description: "ที่อยู่ ผู้ค้ำ" },
        applicantStartDate: { type: 'string', format: 'date', description: 'วันที่เริ่มเข้าทำงาน' }
      },
      required: ['fullName', 'nationalId', 'address'],
    },
  },
  required: ['applicant'],
};

export const requiredDocumentsSchema = [
  { id: 'doc-citizen-id', type: "สำเนาบัตรประชาชน", required: true },
  { id: 'doc-drivers-license', type: 'สำเนาใบขับขี่', required: true },
  { id: 'doc-house-reg', type: 'สำเนาทะเบียนบ้าน', required: true },
  { id: 'doc-car-reg', type: 'สำเนารถ', required: true },
  { id: 'doc-car-photo', type: 'รูปถ่ายรถ', required: true },
  { id: 'doc-bank-account', type: 'บัญชีกสิกร', required: true },
  { id: 'doc-tax-act', type: 'ภาษี พรบ.รถยนต์', required: true },
  { id: 'doc-insurance', type: 'ประกันรถยนต์', required: true },
  { id: 'doc-guarantor-citizen-id', type: 'สำเนาบัตรประชาชน (ผู้ค้ำ)', required: true },
  { id: 'doc-guarantor-house-reg', type: 'สำเนาทะเบียนบ้าน (ผู้ค้ำ)', required: true },
];
