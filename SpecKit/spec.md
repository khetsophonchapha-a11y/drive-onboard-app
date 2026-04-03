# Functional Specification (รายละอียดฟีเจอร์)

## 1. System Features (ฟีเจอร์หลักของระบบ)
| ID | Feature Name | Description (คำอธิบาย) |
| :--- | :--- | :--- |
| **[F-001]** | **Admin Authentication** | ระบบล็อกอินปลอดภัยด้วย Firebase Auth พร้อม Custom Claims (`role=admin`) เพื่อจำกัดสิทธิ์การเข้าถึงทั้งหน้าเว็บและ API |
| **[F-002]** | **Driver App Form** | ฟอร์มใบสมัครแบบ Wizard (ทำทีละขั้น) สำหรับกรอกประวัติ, ข้อมูลรถ, ผู้ค้ำ และอัปโหลดเอกสาร |
| **[F-003]** | **Document Upload (R2)** | อัปโหลดไฟล์ตรงเข้า Cloudflare R2 ผ่าน presigned PUT URLs และดูตัวอย่างไฟล์ด้วย presigned GET URLs แบบมีเวลาจำกัด |
| **[F-004]** | **Completeness Check** | ระบบคำนวณเอกสารที่ขาดหายไป โดยอิงตาม Schema ที่กำหนดไว้ |
| **[F-005]** | **Verification Workflow** | หน้าจอ Admin สำหรับตรวจสอบเอกสาร, ให้คะแนนคุณภาพ, เพิ่มโน้ต, และกดอนุมัติ/ปฏิเสธ |
| **[F-006]** | **Status Management** | ระบบสถานะใบสมัคร (`incomplete`=ไม่ครบ, `pending`=รอตรวจ, `approved`=ผ่าน, `rejected`=ไม่ผ่าน) พร้อม log การเปลี่ยนแปลง |
| **[F-007]** | **AI Analysis Tool** | ใช้ AI (Genkit) วิเคราะห์สาเหตุที่ใบสมัครไม่สมบูรณ์ และสร้างคำแนะนำให้ผู้สมัคร |
| **[F-008]** | **Performance Tuning** | ปรับปรุงประสิทธิภาพระบบ (Web Worker, Caching, Bundle Size) เพื่อลด Latency และ Resource Usage |
| **[F-009]** | **Security Cleanup** | ลบโค้ดทดสอบและช่องโหว่ความปลอดภัย (Test Accounts, Insecure Fallbacks) ก่อน Deploy |
| **[F-010]** | **Daily Report Review** | Popup สำหรับ Admin เพื่อดูและแก้ไขรายงานประจำวันจากหน้า Overview โดยไม่ต้องเปลี่ยนหน้า <br> **Constraint**: User ทั่วไปแก้ไขได้เฉพาะ "วันนี้" เท่านั้น, Admin แก้ไขได้ทุกวัน |
| **[F-011]** | Data Export (ส่งออกข้อมูล) | Admin สามารถ Export รายงานเป็น CSV ได้ |
| **[F-012]** | Idle Timeout Protection (ระบบล็อคเมื่อไม่ใช้งาน) | จับเวลาการใช้งาน หากนิ่งเกิน 3 นาทีให้ขึ้นหน้าจอ Blue Screen บังข้อมูลไว้ |
| **[F-013]** | Dashboard UX Refinement (ปรับปรุงการใช้งาน Dashboard) | Infinite Scroll, Fixed Height Container, Sortable Columns, Order by Date DESC |
| **[F-014]** | **Mobile Responsiveness** | รองรับการใช้งานมือถือเต็มรูปแบบ พร้อม Mobile Navigation และ Responsive Tables |
| **[F-015]** | **Smart Image Handling** | ลดขนาดรูปอัตโนมัติ (WebP/JPEG Fallback), จัดโฟลเดอร์ใน R2, ลบไฟล์เก่าอัตโนมัติ, เน้นการใช้กล้องถ่ายรูป |
| **[F-016]** | **Form Safety** | ระบบป้องกันข้อมูลหาย (Unsaved Changes Warning) เมื่อออกจากหน้า Apply |
| **[F-017]** | **Employee Auto Provisioning** | เมื่อ Admin อนุมัติใบสมัคร ระบบสร้างบัญชี `employee` อัตโนมัติจาก email ในใบสมัคร ตั้งรหัสผ่านเริ่มต้นจากเลขท้าย 6 หลักของบัตรประชาชน และอนุญาตให้ login ได้เฉพาะใบสมัครที่มีสถานะ `approved` เท่านั้น |
| **[F-018]** | **Access Segregation & Duplicate Email Guard** | ป้องกันการส่งใบสมัครซ้ำด้วย email เดียวกันตั้งแต่ตอน submit และแยกเส้นทางใช้งานของ `admin` (`/dashboard/*`) ออกจาก `employee` (`/employee/*`) พร้อม redirect ตาม role อัตโนมัติ |

## 2. Data Models (Simplified Data Structure)
### Drivers / Applications (คนขับ/ใบสมัคร)
- `id`: UUID (รหัสเอกลักษณ์)
- `email`: String (อีเมล - ห้ามซ้ำ)
- `personal_info`: JSON (ข้อมูลส่วนตัว)
- `vehicle_info`: JSON (ข้อมูลรถ)
- `documents`: Array of Objects (รายการไฟล์แนบ) `{ type, url, status, notes }`
- `status`: Enum (สถานะ)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### Daily Report Summary (D1) (สรุปรายงานประจำวัน)
- `email`: TEXT (PK)
- `date`: TEXT (PK)
- `full_name`: TEXT (ชื่อเต็ม)
- `app_id`: TEXT
- `uploaded_count`: INTEGER (จำนวนที่อัปโหลดแล้ว)
- `total_slots`: INTEGER (จำนวนช่องทั้งหมด)
- `status`: TEXT

## 3. Architecture (สถาปัตยกรรมระบบ)
- **Frontend**: Next.js 15 (App Router) โฮสต์บน Vercel/Firebase App Hosting
- **Backend API**: Next.js Server Actions & Cloudflare Workers (สำหรับงานเฉพาะทาง)
- **Database**: Cloudflare D1 (Relational DB) & Firebase Firestore (สำหรับ Real-time/Auth)
- **Storage**: Cloudflare R2 (เก็บไฟล์)
- **Auth**: Firebase Authentication
- **AI**: Google Genkit (Vertex AI)

## 4. User Flows (ขั้นตอนการใช้งาน)
### Applicant (ผู้สมัคร)
1. ลงทะเบียน/เข้าสู่ระบบ
2. กรอกฟอร์มตามขั้นตอน (ข้อมูลส่วนตัว -> รถ -> เอกสาร)
3. อัปโหลดไฟล์ที่จำเป็น
4. กดส่งใบสมัคร

### Admin (ผู้ดูแลระบบ)
1. เข้าสู่ระบบ (ระบบตรวจสอบสิทธิ์)
2. ดูหน้า Dashboard (รายการใบสมัครทั้งหมด)
3. เลือกใบสมัครเพื่อตรวจสอบ
4. ตรวจเอกสารทีละใบ (อนุมัติ/ปฏิเสธ พร้อมเหตุผล)
5. อัปเดตสถานะรวมของใบสมัคร
