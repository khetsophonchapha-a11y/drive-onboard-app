export type VerificationStatus = 'pending' | 'approved' | 'rejected';

// Minimal summary for index.json
export type AppRow = {
  appId: string;
  fullName: string;
  phone?: string;
  createdAt: string; // ISO
  status: VerificationStatus;
};

// Reference to a file stored in R2
export type FileRef = {
  r2Key: string;
  mime: string;
  size: number;
  md5?: string;
};

// Full manifest per application, stored in applications/{appId}/manifest.json
export type Manifest = {
  appId: string;
  createdAt: string; // ISO
  applicant: {
    fullName: string;
    phone: string;
    address?: string;
    nationalId?: string;
  };
  vehicle: {
    brand?: string;
    model?: string;
    plateNo?: string;
    color?: string;
    year?: number;
  };
  guarantor?: {
    fullName?: string;
    phone?: string;
    address?: string;
  };
  docs: {
    citizenIdCopy?: FileRef;
    driverLicenseCopy?: FileRef;
    houseRegCopy?: FileRef;
    carRegCopy?: FileRef;
    carPhotos?: FileRef[];
    kbankBookFirstPage?: FileRef;
    taxAndPRB?: FileRef;
    insurance?: { type?: '1' | '2' | '3'; policy?: FileRef };
    guarantorCitizenIdCopy?: FileRef;
    guarantorHouseRegCopy?: FileRef;
  };
  status: {
    completeness: 'incomplete' | 'complete';
    verification: VerificationStatus;
    notes?: string;
  };
};
