import type { Application } from './types';

export const mockApplications: Application[] = [
  {
    id: 'app-001',
    applicant: {
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '123-456-7890',
      address: '123 Main St, Anytown, USA',
      dateOfBirth: '1990-05-15',
    },
    vehicle: {
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      licensePlate: 'ABC-1234',
      vin: '1234567890ABCDEFG',
    },
    guarantor: {
      fullName: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '098-765-4321',
      address: '456 Oak Ave, Anytown, USA',
    },
    status: 'pending',
    documents: [
      { id: '1', type: "Driver's License", status: 'pending review', fileName: 'license.pdf', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-26T10:00:00Z' },
      { id: '2', type: 'Vehicle Registration', status: 'pending review', fileName: 'registration.pdf', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-26T10:05:00Z' },
      { id: '3', type: 'Proof of Insurance', status: 'missing' },
      { id: '4', type: 'Proof of Address', status: 'approved', fileName: 'utility_bill.jpg', fileUrl: 'https://picsum.photos/seed/doc5/600/400', uploadedAt: '2023-10-25T14:00:00Z' }
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
      fullName: 'Emily White',
      email: 'emily.white@example.com',
      phone: '234-567-8901',
      address: '789 Pine Rd, Anytown, USA',
      dateOfBirth: '1985-11-20',
    },
    vehicle: {
      make: 'Honda',
      model: 'CR-V',
      year: 2022,
      licensePlate: 'XYZ-5678',
      vin: 'HIJKLMNO123456789',
    },
    guarantor: {
      fullName: 'Michael Brown',
      email: 'michael.brown@example.com',
      phone: '109-876-5432',
      address: '101 Maple Ln, Anytown, USA',
    },
    status: 'approved',
    documents: [
      { id: '1', type: "Driver's License", status: 'approved', fileName: 'license.jpg', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-24T09:00:00Z' },
      { id: '2', type: 'Vehicle Registration', status: 'approved', fileName: 'registration.png', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-24T09:05:00Z' },
      { id: '3', type: 'Proof of Insurance', status: 'approved', fileName: 'insurance.pdf', fileUrl: 'https://picsum.photos/seed/doc3/600/400', uploadedAt: '2023-10-24T09:10:00Z' },
       { id: '4', type: 'Proof of Address', status: 'approved', fileName: 'utility_bill.jpg', fileUrl: 'https://picsum.photos/seed/doc5/600/400', uploadedAt: '2023-10-25T14:00:00Z' }
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
      fullName: 'David Green',
      email: 'david.green@example.com',
      phone: '345-678-9012',
      address: '321 Birch St, Othertown, USA',
      dateOfBirth: '1992-02-10',
    },
    vehicle: {
      make: 'Ford',
      model: 'F-150',
      year: 2020,
      licensePlate: 'DEF-456',
      vin: 'PQRSTUVWX987654321',
    },
    guarantor: {
      fullName: 'Sarah Black',
      email: 'sarah.black@example.com',
      phone: '543-210-9876',
      address: '654 Elm St, Othertown, USA',
    },
    status: 'rejected',
    documents: [
      { id: '1', type: "Driver's License", status: 'approved', fileName: 'license.pdf', fileUrl: 'https://picsum.photos/seed/doc1/600/400', uploadedAt: '2023-10-22T12:00:00Z' },
      { id: '2', type: 'Vehicle Registration', status: 'rejected', quality: 'blurry', notes: 'Image is too blurry to read.', fileName: 'rego.jpg', fileUrl: 'https://picsum.photos/seed/doc2/600/400', uploadedAt: '2023-10-22T12:05:00Z' },
      { id: '3', type: 'Proof of Insurance', status: 'missing' }
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
      fullName: '', // Incomplete data
      email: 'chris.blue@example.com',
      phone: '456-789-0123',
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
        { id: '1', type: "Driver's License", status: 'missing' },
        { id: '2', type: 'Vehicle Registration', status: 'missing' },
        { id: '3', type: 'Proof of Insurance', status: 'missing' }
    ],
    auditLog: [
       { timestamp: '2023-10-27T14:00:00Z', user: 'Applicant', action: 'Started application' }
    ],
    createdAt: '2023-10-27T14:00:00Z',
    updatedAt: '2023-10-27T14:00:00Z',
  }
];
