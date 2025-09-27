export const applicationFormSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'แบบฟอร์มสมัครพนักงานขับรถ',
  type: 'object',
  properties: {
    applicant: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: "ชื่อจริง" },
        lastName: { type: 'string', description: "นามสกุล" },
        email: { type: 'string', format: 'email', description: "อีเมล" },
        phone: { type: 'string', description: "เบอร์โทรศัพท์" },
        address: { type: 'string', description: "ที่อยู่" },
        dateOfBirth: { type: 'string', format: 'date', description: "วันเกิด" },
      },
      required: ['firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth'],
    },
    vehicle: {
      type: 'object',
      properties: {
        make: { type: 'string', description: "ยี่ห้อรถ" },
        model: { type: 'string', description: "รุ่นรถ" },
        year: { type: 'integer', minimum: 1900, maximum: new Date().getFullYear() + 1, description: "ปีที่ผลิต" },
        licensePlate: { type: 'string', description: "ป้ายทะเบียน" },
        vin: { type: 'string', description: "เลขตัวถัง" },
      },
      required: ['make', 'model', 'year', 'licensePlate', 'vin'],
    },
    guarantor: {
      type: 'object',
      properties: {
        fullName: { type: 'string', description: "ชื่อ-นามสกุล ผู้ค้ำ" },
        email: { type: 'string', format: 'email', description: "อีเมล ผู้ค้ำ" },
        phone: { type: 'string', description: "เบอร์โทรศัพท์ ผู้ค้ำ" },
        address: { type: 'string', description: "ที่อยู่ ผู้ค้ำ" },
      },
      required: ['fullName', 'phone'],
    },
  },
  required: ['applicant', 'vehicle'],
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
