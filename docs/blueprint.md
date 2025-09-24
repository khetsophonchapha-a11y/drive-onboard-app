# **App Name**: DriveOnboard

## Core Features:

- Admin Authentication: Secure login (Firebase Auth) + Custom Claims (`role=admin`) to restrict access to both UI and API.
- Driver Application Form (Wizard): Form to input applicant, vehicle, guarantor information, and upload documents.
- Document Upload with R2: Upload files directly to R2 with presigned PUT; preview with short-lived presigned GET.
- Document Completeness Check: System calculates missing documents based on the schema.
- Document Verification Workflow: Checklist to review, flag quality, add notes, and approve/reject documents.
- Status Management: Manage application status (`incomplete|pending|approved|rejected`) + audit logging for all actions.
- Incomplete Form Analysis Tool (AI): Analyze reasons for incomplete/incorrect forms using uploaded images/scans/files and generate suggested instructions for applicants as a tool.

## Style Guidelines:

- Primary: Navy Blue #2E4A62
- Background: Light Gray #F0F4F7
- Accent: Teal #33A19F
- Error: Red #D64545
- Success: Green #28A745
- Fonts (Google): Headline `Poppins`, Body `PT Sans`
- Icons: simple/professional for document types & status
- Motion: subtle transitions, upload loading indicators
- Tailwind theme: map สีทั้งหมด และประกาศ `font-heading` = Poppins, `font-sans` = PT Sans
- Clear, structured layout.