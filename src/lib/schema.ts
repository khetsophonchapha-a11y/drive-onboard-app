export const applicationFormSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Driver Application Form',
  type: 'object',
  properties: {
    applicant: {
      type: 'object',
      properties: {
        fullName: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', minLength: 1 },
        address: { type: 'string', minLength: 1 },
        dateOfBirth: { type: 'string', format: 'date' },
      },
      required: ['fullName', 'email', 'phone', 'address', 'dateOfBirth'],
    },
    vehicle: {
      type: 'object',
      properties: {
        make: { type: 'string', minLength: 1 },
        model: { type: 'string', minLength: 1 },
        year: { type: 'integer', minimum: 1900, maximum: new Date().getFullYear() + 1 },
        licensePlate: { type: 'string', minLength: 1 },
        vin: { type: 'string', minLength: 1 },
      },
      required: ['make', 'model', 'year', 'licensePlate', 'vin'],
    },
    guarantor: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        address: { type: 'string' },
      },
      required: ['fullName', 'email', 'phone', 'address'],
    },
  },
  required: ['applicant', 'vehicle'],
};

export const requiredDocumentsSchema = [
  { id: 'doc-license', type: "Driver's License", required: true },
  { id: 'doc-registration', type: 'Vehicle Registration', required: true },
  { id: 'doc-insurance', type: 'Proof of Insurance', required: true },
  { id: 'doc-guarantor-id', type: 'Guarantor ID', required: false }, // Example of conditionally required
  { id: 'doc-proof-of-address', type: 'Proof of Address', required: true },
];
