export type ApplicationStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';
export type DocumentStatus = 'missing' | 'uploaded' | 'pending review' | 'approved' | 'rejected';
export type DocumentQuality = 'clear' | 'blurry' | 'incomplete' | 'incorrect';

export type Document = {
  id: string;
  type: string;
  status: DocumentStatus;
  quality?: DocumentQuality;
  notes?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
};

export type Applicant = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
};

export type Vehicle = {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin: string;
};

export type Guarantor = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
};

export type AuditLog = {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
};

export type Application = {
  id: string;
  applicant: Applicant;
  vehicle: Vehicle;
  guarantor: Guarantor;
  status: ApplicationStatus;
  documents: Document[];
  auditLog: AuditLog[];
  createdAt: string;
  updatedAt: string;
};
