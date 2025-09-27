import type { Application } from './types';

export const mockApplications: Application[] = [
  {
    id: 'app-001',
    applicant: {
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      email: 'somchai.jd@example.com',
      phone: '081-234-5678',
      address: '123 ถ.สุขุมวิท, คลองเตย, กรุงเทพฯ 10110',
      dateOfBirth: '1990-05-15',
    },
    vehicle: {
      make: 'Toyota',
      model: 'Vios',
      year: 2021,
      licensePlate: '1กข 1234',
      vin: '1234567890ABCDEFG',
    },
    guarantor: {
      fullName: 'สมศรี มีสุข',
      email: 'somsri.ms@example.com',
      phone: '089-876-5432',
      address: '456 ถ.รัชดา, ห้วยขวาง, กรุงเทพฯ 10310',
    },
    status: 'pending',
    documents: [
      { id: 'doc-drivers-license', type: "สำเนาใบขับขี่", status: 'pending review', fileName: 'license.pdf', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-26T10:00:00Z' },
      { id: 'doc-car-reg', type: 'สำเนารถ', status: 'pending review', fileName: 'registration.pdf', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-26T10:05:00Z' },
      { id: 'doc-insurance', type: 'ประกันรถยนต์', status: 'missing' },
      { id: 'doc-citizen-id', type: 'สำเนาบัตรประชาชน', status: 'approved', fileName: 'citizen_id.jpg', fileUrl: 'https://picsum.photos/seed/doc5/600/400', uploadedAt: '2023-10-25T14:00:00Z' }
    ],
    auditLog: [
      { timestamp: '2023-10-26T10:05:00Z', user: 'Applicant', action: 'Submitted application' },
      { timestamp: '2023-10-26T11:00:00Z', user: 'Admin', action: 'Reviewed Proof of Address', details: 'Approved' }
    ],
    createdAt: '2023-10-26T10:05:00Z',
    updatedAt: '2023-10-26T11:00:00Z',
  },
  {
    id: 'app-002',
    applicant: {
      firstName: 'เอมิกา',
      lastName: 'ขาวสะอาด',
      email: 'emika.k@example.com',
      phone: '082-345-6789',
      address: '789 ถ.พหลโยธิน, จตุจักร, กรุงเทพฯ 10900',
      dateOfBirth: '1985-11-20',
    },
    vehicle: {
      make: 'Honda',
      model: 'CR-V',
      year: 2022,
      licensePlate: '9กฬ 5678',
      vin: 'HIJKLMNO123456789',
    },
    guarantor: {
      fullName: 'ไมเคิล บราวน์',
      email: 'michael.b@example.com',
      phone: '083-456-7890',
      address: '101 ถ.ลาดพร้าว, วังทองหลาง, กรุงเทพฯ 10310',
    },
    status: 'approved',
    documents: [
      { id: 'doc-drivers-license', type: "สำเนาใบขับขี่", status: 'approved', fileName: 'license.jpg', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-24T09:00:00Z' },
      { id: 'doc-car-reg', type: 'สำเนารถ', status: 'approved', fileName: 'registration.png', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-24T09:05:00Z' },
      { id: 'doc-insurance', type: 'ประกันรถยนต์', status: 'approved', fileName: 'insurance.pdf', fileUrl: 'https://picsum.photos/seed/doc3/600/400', uploadedAt: '2023-10-24T09:10:00Z' },
      { id: 'doc-citizen-id', type: 'สำเนาบัตรประชาชน', status: 'approved', fileName: 'utility_bill.jpg', fileUrl: 'https://picsum.photos/seed/doc5/600/400', uploadedAt: '2023-10-25T14:00:00Z' }
    ],
    auditLog: [
       { timestamp: '2023-10-24T09:10:00Z', user: 'Applicant', action: 'Submitted application' },
       { timestamp: '2023-10-25T16:00:00Z', user: 'Admin', action: 'Approved all documents' }
    ],
    createdAt: '2023-10-24T09:10:00Z',
    updatedAt: '2023-10-25T16:00:00Z',
  },
    {
    id: 'app-003',
    applicant: {
      firstName: 'เดวิด',
      lastName: 'เขียว',
      email: 'david.k@example.com',
      phone: '084-567-8901',
      address: '321 ถ.เพชรบุรี, ราชเทวี, กรุงเทพฯ 10400',
      dateOfBirth: '1992-02-10',
    },
    vehicle: {
      make: 'Ford',
      model: 'F-150',
      year: 2020,
      licensePlate: '2ฒผ 456',
      vin: 'PQRSTUVWX987654321',
    },
    guarantor: {
      fullName: 'สาระ ดำ',
      email: 'sara.d@example.com',
      phone: '085-678-9012',
      address: '654 ถ.พระราม 9, ห้วยขวาง, กรุงเทพฯ 10310',
    },
    status: 'rejected',
    documents: [
      { id: 'doc-drivers-license', type: "สำเนาใบขับขี่", status: 'approved', fileName: 'license.pdf', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-22T12:00:00Z' },
      { id: 'doc-car-reg', type: 'สำเนารถ', status: 'rejected', quality: 'blurry', notes: 'รูปไม่ชัดเจน อ่านไม่ออก', fileName: 'rego.jpg', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-22T12:05:00Z' },
      { id: 'doc-insurance', type: 'ประกันรถยนต์', status: 'missing' }
    ],
    auditLog: [
      { timestamp: '2023-10-22T12:05:00Z', user: 'Applicant', action: 'Submitted application' },
      { timestamp: '2023-10-23T10:00:00Z', user: 'Admin', action: 'Rejected Vehicle Registration', details: 'Image is too blurry to read.' },
       { timestamp: '2023-10-23T10:01:00Z', user: 'Admin', action: 'Set application status to Rejected' }
    ],
    createdAt: '2023-10-22T12:05:00Z',
    updatedAt: '2023-10-23T10:01:00Z',
  },
  {
    id: 'app-004',
    applicant: {
      firstName: '',
      lastName: '', 
      email: 'chris.blue@example.com',
      phone: '086-789-0123',
      address: '',
      dateOfBirth: '1995-07-30',
    },
    vehicle: {
      make: 'Tesla',
      model: 'Model 3',
      year: 2023,
      licensePlate: '',
      vin: 'QRSTUVWXYZ123456789',
    },
    guarantor: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
    },
    status: 'incomplete',
    documents: [
        { id: 'doc-drivers-license', type: "สำเนาใบขับขี่", status: 'missing' },
        { id: 'doc-car-reg', type: 'สำเนารถ', status: 'missing' },
        { id: 'doc-insurance', type: 'ประกันรถยนต์', status: 'missing' }
    ],
    auditLog: [
       { timestamp: '2023-10-27T14:00:00Z', user: 'Applicant', action: 'Started application' }
    ],
    createdAt: '2023-10-27T14:00:00Z',
    updatedAt: '2023-10-27T14:00:00Z',
  }
];
