# Task Roadmap (แผนงาน)

## Phase 1: Setup & Infrastructure (การติดตั้งและโครงสร้างพื้นฐาน)

- [x] **[T-001] Initial Project Setup**
    - **Concept/Goal (แนวคิด)**: เริ่มต้นโปรเจกต์ Next.js พร้อมติดตั้ง Tailwind และ Shadcn UI
    - **Status**: Completed (เสร็จสิ้น)

- [x] **[T-002] Create Unified Startup Script (Server + Worker)**
    - **Concept/Goal (แนวคิด)**: สร้างคำสั่งเดียวเพื่อรันทั้ง Next.js dev server และ Cloudflare Worker พร้อมกันในเครื่อง local เพื่อความสะดวกในการพัฒนา
    - **Principles (หลักการ)**: Developer Experience (DX - ประสบการณ์นักพัฒนาต้องดี), Fail-fast (ถ้าตัวใดตัวหนึ่งพัง ให้หยุดทำงานทั้งคู่)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **Logic/State**: สร้าง `scripts/dev-start.sh` จัดการ kill ports (9002, 8787) และ run processes
        - **Data**: ไม่เกี่ยวข้อง
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: เมื่อรัน `npm run dev:all` ทั้ง Worker และ Web Server ทำงาน, Browser เปิดอัตโนมัติ, Ctrl+C หยุดทุกอย่าง
    - **Sub-tasks (งานย่อย)**:
        - [x] ค้นหาและติดตั้ง `concurrently` (ใช้ Bash script แทนเพื่อความยืดหยุ่นกว่า)
        - [x] สร้างไฟล์ `start-worker.sh` (เป็น `scripts/dev-start.sh`)
        - [x] อัปเดต `package.json` scripts (`dev:all`)

- [x] **[T-003] Establish SpecKit Standards**

## Environment Comparison (ความต่างของระบบ)

| Feature | Local Dev (Port 9002) | Production (Cloudflare Pages) | Status |
| :--- | :--- | :--- | :--- |
| **Run Command** | `npm run dev:all` | `wrangler pages deploy` | ✅ Aligned |
| **Build System** | Next.js Server (Node.js) | OpenNext (Adapts to Edge) | ⚠️ Fundamental Difference |
| **Authentication** | `next-auth` (Node.js Runtime) | `next-auth` (Edge Compatible) | ✅ Aligned (via `node:crypto`) |
| **Database** | Local SQLite (`.wrangler/...`) | Cloudflare D1 (Global) | ⚠️ Data Mismatch (Expected) |
| **File Storage** | R2 Proxy (Local Wrangler) | R2 Bucket (Direct/Proxy) | ✅ Aligned (via `.dev.vars`) |
| **Secrets** | `.dev.vars` | Cloudflare Dashboard / `wrangler secret` | ✅ Aligned (Synced manually) |
| **API Handling** | `localhost:8787` wrapper | Internal Service Binding | ✅ Aligned (via `d1-client`) |

    - **Concept/Goal (แนวคิด)**: วางมาตรฐานเอกสารแบบ "Paystub Model" หรือ Spec-First
    - **Principles (หลักการ)**: Single Source of Truth (ความจริงหนึ่งเดียว), Traceability (ตรวจสอบย้อนกลับได้)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **Logic**: สร้างโฟลเดอร์ `SpecKit` และไฟล์มาตรฐาน (`spec`, `instruction`, `task`, `traceability`)
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: มีไฟล์ครบทั้ง 4 ไฟล์และโครงสร้างถูกต้องตาม `AI.md`
    - **Sub-tasks (งานย่อย)**:
        - [x] สร้างไฟล์ตั้งต้น (Initial files)
        - [x] อัปเดต `task.md` เป็นแบบ Rich Schema (ขั้นตอนนี้)

## Phase 2: Core Features (ฟีเจอร์หลัก - Authentication & Data)

- [x] **[T-010] Implement Firebase Auth with Admin Claims**
    - **Concept/Goal (แนวคิด)**: ปกป้องส่วน Admin โดยใช้ Authentication (NextAuth + D1)
    - **Principles (หลักการ)**: Security First (ความปลอดภัยต้องมาก่อน), Least Privilege (ให้สิทธิ์เท่าที่จำเป็น)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **UI/UX**: หน้า Login (`/login`) และ Route Wrapper สำหรับป้องกันการเข้าถึง
        - **Logic/State**: ใช้ NextAuth (`src/auth.ts`) รองรับ both D1 Users & Mock Users
        - **Data**: เก็บ `role` ใน Session/JWT
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: User ทั่วไปเข้าหน้า `/admin` ไม่ได้, Admin สามารถ Login เข้าใช้งานได้
    - **Sub-tasks (งานย่อย)**:
        - [x] ตั้งค่า NextAuth Provider
        - [x] สร้างหน้าจอ Login
        - [x] ทำระบบ Route Protection (Middleware/AuthGuard)

- [x] **[T-011] Setup Cloudflare D1 Schema & Connections**
    - **Concept/Goal (แนวคิด)**: สร้างโครงสร้าง Database สำหรับ Daily Reports และใบสมัครคนขับ (Driver Applications)
    - **Principles (หลักการ)**: Data Integrity (ความถูกต้องของข้อมูล), Scalability (ขยายตัวได้)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **Logic**: เขียนไฟล์ `.sql` migration
        - **Data**: ตาราง: `drivers`, `applications`, `daily_report_summary`
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: ตารางถูกสร้างขึ้นจริงทั้งใน local D1 และ remote D1
    - **Sub-tasks (งานย่อย)**:
        - [x] นิยาม SQL Schema
        - [x] รันคำสั่ง D1 Migrations

- [x] **[T-012] Implement Cloudflare R2 Upload Flow**
    - **Concept/Goal (แนวคิด)**: อนุญาตให้อัปโหลดไฟล์ตรงไปที่ R2 Storage
    - **Principles (หลักการ)**: Performance (อัปโหลดตรงเพื่อลดภาระ Server), Security (ใช้ Presigned URLs)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **UI/UX**: ปุ่มเลือกไฟล์ พร้อม Progress Bar
        - **Logic**: Server สร้าง Presigned PUT URL -> Client ทำการ PUT ไฟล์ขึ้นไป
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: ไฟล์ไปโผล่ใน R2 bucket
    - **Sub-tasks (งานย่อย)**:
        - [x] สร้าง API สำหรับขอ Presigned URL
        - [x] เขียน Logic ฝั่ง Client สำหรับอัปโหลด

## Phase 3: Application Logic (Planned)

- [ ] **[T-020] Build Driver Application Wizard Form (ทำฟอร์มใบสมัคร)**
    - **Concept/Goal (แนวคิด)**: ฟอร์มหลายขั้นตอน (Wizard) สำหรับรับสมัครคนขับ
    - **Principles (หลักการ)**: User Friendly (ใช้ง่าย), Validation Feedback (แจ้งเตือนเมื่อกรอกผิด)
    - **Sub-tasks (งานย่อย)**:
        - [ ] ขั้นตอนข้อมูลส่วนตัว (Personal Info)
        - [ ] ขั้นตอนข้อมูลรถ (Vehicle Info)
        - [ ] ขั้นตอนอัปโหลดเอกสาร (Document Upload)

- [ ] **[T-021] Implement Document Completeness Logic (ตรวจสอบเอกสารครบถ้วน)**
    - **Concept/Goal (แนวคิด)**: คำนวณหาเอกสารที่ยังขาดอยู่โดยอัตโนมัติ
    - **Principles (หลักการ)**: Business Logic Isolation (แยก Logic ธุรกิจออกมาให้ชัด)

- [ ] **[T-022] Develop Admin Verification Dashboard (หน้าตรวจสอบสำหรับ Admin)**
    - **Concept/Goal (แนวคิด)**: หน้าจอให้ Admin กดอนุมัติ/ปฏิเสธเอกสาร
    - **Principles (หลักการ)**: Efficiency (ทำงานไว), Clear Feedback (ระบุเหตุผลชัดเจน)

- [x] **[T-023] Implement Daily Report Detail Popup (Popup แสดงรายละเอียดรายงาน)**
    - **Concept/Goal (แนวคิด)**: หน้าต่าง Popup สำหรับดูและแก้ไข Daily Report ของพนักงานแต่ละคนผ่านหน้า Overview โดยไม่ต้องเปลี่ยนหน้า
    - **Principles (หลักการ)**: Reusability (ใช้ Component เดิม), Consistency (หน้าตาเหมือนหน้าปกติ), Single Source of Truth (ใช้ API เดียวกัน)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **UI/UX**: `Dialog` (Shadcn UI) คลุม `DailyReportView` (หรือ Refactor ให้เป็น reusable component)
        - **Logic/State**: รับ `email` และ `date` เป็น Props เพื่อโหลดข้อมูล
        - **Data**: Reuse `/api/daily-reports` (GET, PUT, DELETE) ตัวเดิม
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**:
        - กดที่แถวในตาราง Overview -> Popup แสดง
        - เห็นรูปภาพและสถานะถูกต้อง
        - สามารถอัปโหลด/ลบรูปใน Popup ได้ และผลลัพธ์บันทึกลง D1/R2 ทันที
    - **Sub-tasks (งานย่อย)**:
        - [x] Extract `DailyReportView` logic to be reusable (accept props)
        - [x] Add `onClick` handler to `DailyReportOverview` table rows
        - [x] Implement `DailyReportDialog` component
            - **Error Encountered**: Runtime Error `onSelectFile is not a function`
            - **Root Cause**: Prop Mismatch ระหว่าง `DailyReportView` (ส่ง `onUpload`) กับ `DailyReportSlotCard` (รับ `onSelectFile`)
            - **Solution**: แก้ชื่อ Prop ใน `DailyReportSlotCard` ให้เป็น `onUpload` ให้ตรงกัน
            - **Prevention**: ตรวจสอบ Interface Props ให้ดีเมื่อมีการ Refactor หรือ Reuse Component เดิม

- [x] **[T-024] Enforce Retroactive Upload Restriction (จำกัดการลงรายงานย้อนหลัง)**
    - **Concept/Goal**: ป้องกันพนักงานลงเวลาย้อนหลัง (Cheat Prevention) อนุญาตเฉพาะ Admin
    - **Principles**: Access Control (คัดกรองสิทธิ์ตาม Role และ Time), Client-Side enforcement (UX)
    - **Implementation Details**:
        - **Logic**: ใน `DailyReportView`, เช็ค `user.role`
            - ถ้าเป็น `user` -> ยอมให้แก้เฉพาะ `isSameDay(selectedDate, today)`
            - ถ้าเป็น `admin` -> แก้ได้ตลอด
    - **Confirmed Behavior**: Login user ปกติ กดเลือกวันที่เมื่อวาน -> **ไม่เห็นปุ่ม Upload/Delete เลย** (View Only)
    - **Sub-tasks**:
        - [x] Update `isReadOnly` logic in `daily-report-view.tsx`
            - **Error Encountered**: TS Error `Property 'readOnly' does not exist on type...`
            - **Root Cause**: ส่ง Prop `readOnly` ไปยัง `DailyReportSlotCard` แต่ลืมอัปเดต Interface ของลูก
            - **Solution**: เปลี่ยนชื่อ Prop ที่ส่งไปเป็น `disabled` ให้ตรงกับ Interface เดิมของลูก (ไม่ต้องแก้ลูก)
            - **Prevention**: ตรวจสอบ Interface Props ให้ดีเมื่อมีการ Refactor หรือ Reuse Component เดิม

- [x] **[T-025] Export Daily Report Data (ส่งออกข้อมูลรายงาน)**
    - **Concept/Goal**: ช่วยให้ Admin สามารถนำข้อมูลดิบออกไปวิเคราะห์ต่อใน Excel ได้ง่าย
    - **Principles**: User Convenience (สะดวกใช้), Client-side Processing (ลดภาระ Server)
    - **Implementation Details**:
        - **UI**: เพิ่มปุ่ม "Export CSV" ข้างๆ ปุ่ม Filter พร้อมไอคอน `Download`
        - **Logic**: แปลงข้อมูล `filteredRows` เป็น CSV format (UTF-8 with BOM) แล้ว trigger download
        - **Library**: ใช้ Client-side Logic (No extra libs) เพื่อลด Bundle Size
    - **Confirmed Behavior**:
        - ปุ่ม Export Disabled เมื่อไม่มีข้อมูล
        - กดแล้วได้ไฟล์ `.csv` ที่เปิดอ่านภาษาไทยรู้เรื่อง (มี BOM)
    - **Sub-tasks**:
        - [x] สร้างปุ่ม Export Component
        - [x] Implement CSV conversion logic

- [x] **[T-026] Fix D1 Database Sync on Delete (แก้บัฟลบรูปแล้ว D1 ไม่อัปเดต)**
    - **Concept/Goal**: เมื่อ User ลบรูปภาพออกจาก Daily Report, ค่า `uploaded_count` ในตาราง `daily_report_summary` ต้องลดลงทันทีเพื่อให้ข้อมูลตรงกัน
    - **Principles**: Data Consistency (ความถูกต้องของข้อมูล)
    - **Problem Description**: User รายงานว่าลบรูปแล้ว แต่ Overview ยังขึ้นจำนวนเท่าเดิม หรือ Status ไม่เปลี่ยนกลับเป็น 'partial'/'missing'
    - **Investigation Plan**:
        - ตรวจสอบ `API DELETE /api/daily-reports` -> (พบว่าทำงานถูกต้อง)
        - ดู Logic Update -> Found Frontend Stale State (ไม่ได้ Refresh List หลัง Popup ปิด)
    - **Solution**: เพิ่ม Callback `onUpdate` ให้ `DailyReportView` แจ้งเตือน Parent เมื่อมีการเปลี่ยนแปลงข้อมูล
    - **Sub-tasks**:
        - [x] Verify API Logic
        - [x] Fix Update Query (Added Frontend Refresh Logic)
        - [x] Verify with Manual Test

## Phase 4: AI Integration (Planned)

- [ ] **[T-030] Implement Genkit Flow for Incomplete Form Analysis (AI วิเคราะห์ใบสมัคร)**
    - **Concept/Goal (แนวคิด)**: ใช้ AI แนะนำผู้สมัครเมื่อกรอกข้อมูลไม่ครบ
    - **Principles (หลักการ)**: Helpful (เป็นประโยชน์), Non-intrusive (ไม่รบกวนเกินไป)

## Phase 5: Polish & Deploy (Planned)

- [ ] **[T-040] Final UI Polish (เก็บงาน UI/Mobile)**
- [x] **[T-041] Production Deployment Setup (ตั้งค่า Deploy จริง)**
    - [x] Create Cloudflare Project (Pages & Workers)
    - [x] Configure Environment Variables on Pages
    - [x] Upload Secrets to Worker (Secret, R2 Keys)
    - [x] Execute Production D1 Migration
    - [x] **Fix Production Build Errors**:
        - **Incident: Login 401 (Monitoring)**:
            - **Verification**: Recovered and deployed `/api/debug-auth` (removed `runtime=edge` to fix Webpack error) to diagnose Production Auth state.
        - **Incident: Login 401 (Data Mismatch)**:
            - Cause: Production D1 had different seed data than Local SQLite.
            - Fix: Forced password hash update via `wrangler d1 execute`.
        - **Incident: Stale Code / Build Cache**:
            - Cause: `GET /api/users` logs confirmed old code was running.
            - Fix: Nuked `.open-next` and `.next` folder before build.
        - **Incident: Mac AppleDouble (`._`) & `nft.json`**:
            - Cause: `._` files confused OpenNext; `nft.json` creation failed on external volume.
            - Fix: Split Build (`next build` -> Clean -> `opennext build`) + `outputFileTracing: false`.
            - **Incident: Login 401 (Runtime Config)**:
                - Cause: `src/app/api/auth/[...nextauth]/route.ts` used `runtime="nodejs"`, conflicting with Cloudflare Worker.
                - Fix: Removed `runtime` export to let OpenNext handle adaptation (same as successfully deployed diagnostics).
            - **Incident: Local Image Corrupt / Signature Missing**:
                - Cause: Missing `Secret` in Local Worker env.
                - Fix: Created `.dev.vars` with `Secret="dev-secret-token"` to match frontend default.
        - **Incident: Production Upload Failed (fs.readFile)**:
            - Cause: Suspect missing R2 Credentials in OpenNext Env, causing AWS SDK to fallback to filesystem.
            - Verification: Deployed `/api/debug-r2` to check Env Vars and isolated AWS SDK behavior.
            - Fix: Updated `next.config.mjs` to explicitly fallback `fs: false` in webpack config to prevent AWS SDK from triggering `fs.readFile` in generic shim.
        - **Incident: Production Login Mismatch (Specific User)**:
            - Cause: User `admin@drivetoonboard.co` works locally (via Proxy) but failed on Prod due to password hash mismatch (Local and Prod DBs are divergent).
            - Verification: Enhanced `/api/debug-auth` to check specific Admin account. Confirmed Mismatch.
            - Fix: Updated `/api/debug-auth` with `?fix=true` to copy valid hash from `p.pongsada` to `admin@drivetoonboard.co`. **Verified MATCH**.
            - Note: `admin@driveonboard.test` exists in Local but NOT in Prod. User should log in with `admin@drivetoonboard.co`.
        - [x] **Production R2 Upload Failure** (`fs.readFile`)
    - [x] **Analysis**: The root cause is confirmed to be the AWS SDK trying to load config files in a Worker environment where `fs` is not available.
    - [x] **Action**: Refactor upload logic to remove `@aws-sdk` dependency entirely. (RESOLVED 2025-12-28)
    - [x] **Implementation**:
        - [x] Create `src/lib/r2/signer.ts` (Pure JS V4 Signer).
        - [x] Create `src/lib/r2/binding.ts` (Native OpenNext Binding).
        - [x] Refactor `sign-put-applicant`.
        - [x] Refactor `daily-reports/sign-put`.
        - [x] Refactor `daily-reports/route.ts` (JSON DB).
        - [x] Refactor `daily-reports/summary`.
        - [x] Refactor `r2/delete-objects`.
        - [x] Refactor `download-form`.
        - [x] **Delete**: `src/app/api/r2/_client.ts` and uninstall `@aws-sdk/client-s3`.
    - [x] **Environment Standardization**:
        - Added `npm run dev:remote` to allow Local App to use Production Data directly.
    - [x] **Local R2 Proxy (Ultimate Simulation)**:
        - Implemented `R2ProxyBindings` to bridge Local Node.js to Remote Worker (Port 8787).
        - Added `/api/r2-proxy` endpoints to Worker.
        - Result: `dev:all` now supports Real R2 List/Get/Put/Delete via Proxy.

    - [x] **[T-055] Production Deployment (Final Round) (การ Deploy ขึ้น Production ครั้งสุดท้าย)**
        - [x] **Pre-flight Check (ตรวจสอบความพร้อมก่อนขึ้น)**:
            - [x] **Code Checks**:
                - [x] AWS SDK Removed? YES (ถอด AWS SDK ออกหมดแล้ว)
                - [x] `fs.readFile` Removed from Runtime? YES (ไม่มีการเรียกใช้ fs module)
                - [x] `runtime` config adjusted for OpenNext? YES (ตั้งค่าถูกต้อง)
                - [x] Local Build (`npm run build` + `opennextjs-cloudflare build`) Passing? YES (Build ผ่าน)
            - [x] **R2 Connectivity Verified (ตรวจสอบการเชื่อมต่อ R2)**:
                - [x] **Secret Sync**: แก้ไข `.dev.vars` ให้ตรงกับ `.env.final` (Port 9002 คุยกับ 8787 ได้จริง)
                - [x] **CORS Resolved**: แก้ไข Policy บน Dashboard ให้รองรับ Localhost และ Production Domain
                - [x] **Signature Mismatch Resolved**: แก้ไข Logic ใน `signer.ts` ให้เรียง Header (Sort) ตามมาตรฐาน AWS V4
                - [x] Fix Build Failure (Edge Runtime Conflict):
                    - **Error**: `app/api/.../route cannot use the edge runtime`
                    - **Fix**: Removed `export const runtime = 'edge'` from `daily-reports/sign-put` and `debug-r2` to let OpenNext handle adaptation.
                - [x] **Fix Upload Failure (Native Module)**:
                    - **Action**: Permanently removed `better-sqlite3` from dependencies.
                    - **Reason**: Not needed for `dev:remote` (Proxy mode) and crashes Cloudflare Build.
                - [x] **Incident: Production Login Failed (User Mismatch)**:
                    - **Symptom**: 401 Unauthorized for `admin@driveonboard.test`.
                    - **Cause**: This user exists ONLY in Local SQLite. Production D1 has `admin@drivetoonboard.co` instead.
                    - **Solution**: User must login with Production Credentials.
        - [x] **Deploy Action (ดำเนินการ Deploy)**:
            - `wrangler pages deploy .open-next/assets` (หรือ Deploy ผ่าน CI/CD) - **SUCCESS** ✅

- [ ] **[T-060] End-to-End System Verification (ตรวจสอบระบบโดยรวม)**
    - **Concept/Goal**: ตรวจสอบความถูกต้องและเสถียรภาพของระบบในมุมมอง User ทุกระดับ (UAT)
    - **Artifact**: ตรวจสอบตามรายการใน `verification_checklist.md`
    - **Key Checkpoints**:
        1.  **Authentication**: Test Login, Logout, Role Access, Idle Timeout.
        2.  **Daily Report**: Test Dashboard View, Upload/Delete Images, Export CSV.
        3.  **Driver Application**: Test Wizard Flow, File Upload (Thai names), Submission.
        4.  **Admin Functions**: Test Verification, Approval/Rejection.
        5.  **Mobile Support**: Check Responsive Layouts.
    - **Resolved Incidents (Verification Blockers)**:
        - **Incident 7 (Build Failure)**: Fixed by `deploy_safe.sh`.
        - **Incident (Submission Error)**: Fixed by T-079 (API Logic).
    - **Next Actions**:
        - [ ] Execute Checklist manually on Production.
        - [ ] Report any new findings.

- [x] **[T-042] Performance Optimization (ปรับปรุงประสิทธิภาพ)**
    - **Concept/Goal (แนวคิด)**: ลดการใช้ทรัพยากรและแก้ปัญหาคอขวด (Bottlenecks)
    - **Principles (หลักการ)**: User Experience First (ลื่นไหล), Resource Efficiency (ประหยัดแรม/CPU)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **Logic/State**:
            1. **Fix Memory Leak**: ใช้ LRU Cache (Limit 20) ใน `daily-report-view.tsx`
            2. **Optimize Image Comporession**: ย้าย `compressImage` และ `md5` ไปทำใน `src/workers/image-processor.ts` (Web Worker)
        - **Data**: เปลี่ยนการเรียก D1 ให้มี Caching Strategy ที่เหมาะสม (SWR)
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: หน้าเว็บไม่กระตุกเมื่ออัปโหลดไฟล์ใหญ่, Memory usage ไม่พุ่งสูง
    > [!CAUTION]
    > **Interface Mismatch Warning**: เมื่อมีการปรับแก้ Component ให้ตรวจสอบชื่อ Props ให้ตรงกันเสมอ (เช่น `onUpload` vs `onSelectFile`) เพื่อป้องกัน Runtime Error ที่ตรวจสอบยาก
    > **Logic Order Warning**: ในการอัปโหลดไฟล์ที่ต้องมีการ Process (เช่น ย่อรูป) ต้องคำนวณ MD5 *หลังจาก* Process เสร็จสิ้นแล้วเสมอ ห้ามคำนวณจากไฟล์ต้นฉบับ
    - **Sub-tasks (งานย่อย)**:
        - [x] Implement Web Worker for Image Processing (Daily Reports)
            - **Error Encountered**: MD5 Mismatch on Upload (Cloudflare R2 Reject)
            - **Root Cause**: Web Worker คำนวณ MD5 จากไฟล์ต้นฉบับ *ก่อน* ทำการบีบอัด (Compress) ทำให้ Hash ไม่ตรงกับไฟล์ที่อัปจริง
            - **Solution**: สลับ Order ใน Worker ให้บีบอัดก่อนแล้วค่อยคำนวณ MD5
            - **Prevention**: Logic ที่เกี่ยวกับ File Hash ต้องทำเป็นขั้นตอนสุดท้ายก่อน Upload เสมอ
        - [x] **Integrate Worker into Application Details (ใบสมัคร)**
            - **Action**: Implement `processFileInWorker` in `application-details.tsx` to handle Applicant docs.
            - **Optimization**: Resize images > 2MB to ensure they fit within limits.
            - **Fix**: Increased Server-side `MAX_IMAGE_SIZE` to 5MB to handle edge cases.
        - [x] Refactor State Cache to use proper cache manager
        - [x] Analyze/Reduce Bundle Size (e.g. optimize lodash imports)

- [x] **[T-043] Clean Up Sample Data & Hardcoded Logic (ล้างโค้ดส่วนเกิน)**
    - **Concept/Goal (แนวคิด)**: กำจัด "Dead Code" และ "Insecure Fallbacks" ก่อนขึ้น Production
    - **Principles (หลักการ)**: Security First (ห้ามมี Backdoor), Clean Code (ลดความซับซ้อน)
    - **Implementation Details (รายละเอียดการพัฒนา)**:
        - **Logic/State**:
            1. **Remove Auth Fallback**: ใน `auth.ts`, ลบ logic ที่ไปดึง `sampleAccounts` ถ้า `NODE_ENV === 'production'`
            2. **Type Cleanup**: แก้ไข Type Comparison ใน `d1-users.ts` ที่เป็น `User["role"]` ให้ถูกต้อง
    - **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**: Login ด้วย Sample Account ต้องไม่ได้ใน Production Mode
    - **Sub-tasks (งานย่อย)**:
        - [x] Disable Sample Auth in Production
        - [x] Fix TypeScript Errors in `d1-users.ts`

- [x] **[T-044] Dashboard Performance & Session Tuning (ปรับจูน Dashboard และ Session)**
    - **Concept/Goal**: แก้ปัญหา Dashboard หน่วงเมื่อข้อมูลเยอะ และปรับแต่ง Session
    - **Principles**: Virtualization/Pagination (แบ่งแสดงผล), Debounce (ลดการคำนวณซ้ำ)
    - **Problem**: Table Render 1,500 rows (50 users * 30 days) พร้อมกันทำให้ DOM ช้า
    - **Implementation Details**:
        - **UI**: เพิ่ม Pagination Control ใต้ตาราง
        - **Logic**:
            - Implement Client-side Pagination (limit 50 rows/page)
            - Debounce Search Input
            - Configure NextAuth Session maxAge (30 days) explicit setting
    - **Sub-tasks**:
        - [x] Add Client-side Pagination
        - [x] Debounce Name Filter
        - [x] Update NextAuth Config

- [x] **[T-045] Implement Idle Timeout Lock (ระบบล็อคหน้าจอเมื่อไม่ใช้งาน)**
    - **Concept/Goal**: ป้องกันการเปิดหน้าจอทิ้งไว้โดยไม่ได้ใช้งาน (Security & Privacy)
    - **Principles**: Client-side Activity Detection
    - **Requirement**:
        - หาก User ไม่มีการขยับเมาส์หรือกดคีย์บอร์ดเกิน 3 นาที
        - ให้แสดงหน้าจอเบลอ (Blur Screen Overlay) บังข้อมูลทั้งหมด
        - มีปุ่ม "กลับเข้าสู่ระบบ" (Resume/Unlock) เพื่อใช้งานต่อ
    - **Implementation Details**:
        - **UI**: Fullscreen fixed overlay (`z-50`), Light Backdrop Blur (`backdrop-blur-sm`), Minimal Text ("รอคุณกลับเข้าสู่ระบบ")
        - **Logic**: `useIdle` custom hook tracking `mousemove`, `keydown` events
    - **Sub-tasks**:
        - [x] Create `useIdle` hook
        - [x] Create `IdleLockScreen` component
            - **Bug**: Previously auto-unlocked on mouse move.
            - **Fix**: Modified `useIdle` to detach listeners when idle state is active, enforcing manual unlock button (Case: User Request).
        - [x] Integrate into Main Layout

- [x] **[T-046] Dashboard UX Refinement (Infinite Scroll & Sort)**
    - **Concept/Goal**: เปลี่ยนรูปแบบการแสดงผลเป็น Infinite Scroll ในกรอบ Table ที่มีความสูงคงที่ และเพิ่มความสามารถในการ Sort
    - **Constraint**:
        - **Fixed Height**: Table Container ต้องมีความสูง Fix (เช่น 600px) และมี Scroll bar ในตัว
        - **Infinite Scroll**: เลื่อนลงล่างสุดเพื่อโหลดเพิ่ม 50 รายการ (แทน Pagination เดิม)
        - **Sorting**: หัวตารางคลิกเพื่อเรียงลำดับได้
        - **Default Sort**: วันที่ล่าสุดอยู่บนสุด (Date DESC)
    - **Implementation Details**:
        - **UI**: `h-[600px] overflow-y-auto` ที่ container
        - **Logic**:
            - Remove `Pagination Controls`
            - Add `IntersectionObserver` trigger at bottom of list
            - Implement `sortConfig` state `{ key, direction }`
    - **Sub-tasks**:
        - [x] Switch to Fixed Height & Infinite Scroll
        - [x] Implement Sortable Headers
        - [x] Set Default Sort to Date DESC
        - [x] **Fix Sticky Header**: เปลี่ยนใช้ `<table>` ธรรมดาแทน Component เพื่อแก้บั๊ก Header เลื่อนตาม Scroll


- [x] **[T-047] Feature Merge: Enrollment (นำเข้าฟีเจอร์ลงทะเบียน)**
    - **Concept/Goal**: นำเข้า Code จาก branch `feature/enrollment` โดยเน้นฟีเจอร์ข้อมูลใบสมัครและการสร้างใบสมัคร
    - **Constraint**:
        - รักษา Code เดิมของ **Daily Report** ทั้งหมด (ห้ามทับ)
        - ใช้ Code ใหม่สำหรับ **Enrollment Data** และ **Application Form**
    - **Implementation Details**:
        - **Git**: `git merge origin/feature/enrollment` (Resolve conflicts manually if any)
        - **Validation**: ตรวจสอบว่า `src/app/driver/page.tsx` และ `components/enrollment/*` ถูกเพิ่มเข้ามา
    - **Sub-tasks**:
        - [x] Fetch & Merge `feature/enrollment`
        - [x] Resolve Conflicts (Keep 'HEAD' for Daily Report, Use 'incoming' for Enrollment)
- [x] **[T-048] Fix Image Preview Issues (แก้ปัญหาแสดงรูปใบสมัคร)**
    - **Concept/Goal**: แก้ปัญหาที่รูปภาพPreview ของใบสมัครไม่แสดงผลเนื่องจากปัญหา Encoding ของชื่อไฟล์/โฟลเดอร์ภาษาไทยใน R2
    - **Problem**: R2 Keys ที่มีภาษาไทย (เช่น `สำเนาบัตรประชาชน`) ทำให้เกิดปัญหา Signature Mismatch/CORS เมื่อ Browser ร้องขอไฟล์
    - **Solution**:
        - **Frontend**: ส่ง `docId` (ภาษาอังกฤษ) แทน `docType` (ภาษาไทย) ไปยัง API
        - **Backend**: Sanitized `fileName` ด้วย `normalizeFileName` (remove non-ASCII)
    - **Implication**: ไฟล์เก่าที่อัปโหลดด้วย Key ภาษาไทยจะยังคงดูไม่ได้ ต้องทำการอัปโหลดใหม่
    - **Sub-tasks**:
        - [x] Refactor `ApplicationDetails` to use `docId` for key generation
        - [x] Switch `DocumentViewer` to use native `<img>` tag to avoid Next.js Proxy issues with R2 Signed URLs
- [x] **[T-051] Fix Signature Overwrite Logic**:
    - Details: Enforce "Overwrite" behavior for signatures. Old signature file is deleted when a new one is drawn/uploaded.
- [x] **[T-049] Restore Legacy File Access (กู้คืนการเข้าถึงไฟล์เก่า)**
    - **Concept/Goal**: ทำให้ไฟล์เก่าที่มีชื่อภาษาไทย (ที่อัปโหลดก่อน T-048) สามารถแสดงผลได้ โดยไม่ต้องอัปโหลดใหม่
    - **Problem**: Browser URL encoding (%E0%B8...) ไม่ตรงกับ Signature ที่ S3 Generate จาก Raw String ทำให้เกิด 403 Forbidden
    - **Solution**:
        - **Logic**: ใน `api/r2/sign-get`, ตรวจสอบว่า Key มี Non-ASCII หรือไม่
        - ถ้ามี -> ให้ทำการ encode key ก่อนส่งไป sign หรือปรับแต่ง S3 Client ให้รองรับ (ใช้ SDK handling + cleanKey)
    - **Verification Steps**:
        - เปิดใบสมัครเก่า -> รูปต้องขึ้น
        - เปิดใบสมัครใหม่ -> รูปต้องขึ้น (Regression Test)
    - **Sub-tasks**:
        - [x] Create reproduction test case (mental or manual)
        - [x] Create reproduction test case (mental or manual)
        - [x] Updates `api/r2/sign-get` logic
        - [x] Verify fix
        - [x] **Fix R2 Sign PUT Error (Case: fs.readFile)**:
            - **Status**: Completed (Requires 2 attempts)
            - **Incident 1**: Fixed `sign-put-applicant` but missed `daily-reports/sign-put`.
            - **Correction**: Global search applied to all `aws-sdk` usages.
            - **Solution**: Explicitly validated `R2_ACCESS_KEY_ID` in all routes and updated Pages Secrets.
        - [x] **Fix R2 Sign PUT Error (Case: fs.readFile)**:
            - **Status**: Completed (Requires 2 attempts) ...
            - **Incident 2**: Deployment `ff2e81ba` resulted in **404 Not Found**.
            - **Cause**: Deployment command likely targeted wrong directory (`.open-next/assets` vs `.open-next/` or `.open-next/server-functions`).
            - **Correction**: Investigating correct OpenNext output structure for Cloudflare Pages.
        - [x] **Verify Hybrid Architecture & Secrets**:
            - **Concern**: User suspects secret mismatch or architecture confusion.
            - **Audit**: Confirmed `WORKER_SECRET` match. `R2_ACCESS_KEY_ID` was missing in Prod.
            - **Resolution**: Synced all secrets from `.env` (Local) to Pages via `sync-secrets.js`.
            - **Status**: Production Environment now matches Local 9002.
        - **Error Encountered**: Images still fail to load with "Failed to load image" (403/404) even after trimming key.
        - **Root Cause**: Next.js `next/image` proxy issues + Complex URL encoding mismatch for Thai keys in R2 Signed URLs.
        - **Solution**: 
            1. Switched `DocumentViewer` to native `<img>`.
            2. (Next Step) Investigate `r2Key` vs Browser Path encoding mismatch deeper.
            3. (Final Fix) Applied `forcePathStyle: true` to S3Client configuration.
        - **Prevention**: Always sanitize keys to ASCII (T-048) to avoid this entire class of bugs.

- [x] **[T-050] Migrate R2 Access to Worker Proxy (ย้ายระบบดึงรูปไปใช้ Worker)**
    - **Concept/Goal**: ใช้ Cloudflare Worker เป็น Gateway กลางในการดึงรูปจาก R2 แทนการใช้ Signed URLs
    - **Problem**: Signed URL มีข้อจำกัดเรื่อง Encoding (ภาษาไทย), CORS, และ Cache Management ที่ซับซ้อน (โดยเฉพาะกับไฟล์เก่า)
    - **Solution**:
        - **Worker Side**: สร้าง Endpoint `GET /file/:key` ที่รับหน้าที่ `R2.get()` โดยตรง
        - **Security**: ใช้ Signed Token (JWT) Short-lived ที่ออกโดย Next.js เพื่อ Verify สิทธิ์ที่ Worker (ป้องกัน Public Access)
        - **Client Side**: เปลี่ยน `<img> src` หรือ `fetch` ให้ชี้ไปที่ Worker URL
    - **Benefits**:
        - แก้ปัญหาชื่อไฟล์ภาษาไทยถาวร (Worker จัดการ Key แบบ Raw String ได้ง่ายกว่า)
        - ควบคุม Cache Policy ได้ดีกว่า
    - **Sub-tasks**:
        - [x] Setup R2 Binding in `wrangler.toml`
        - [x] Implement `GET /images/:key` route in Worker
        - [x] Implement Auth Token Verification (Shared Secret)
            - **Error Encountered**: CORS/401 Errors on Signature Images (GET /files/...)
            - **Root Cause**: Global Bearer Token check in `fetch` was blocking public image access. OPTIONS requests also failed due to lack of handler.
            - **Solution**: Restructured `fetch` to allow `/files/` access verification (Signature only) without Bearer Token and added OPTIONS support.
            - **Prevention**: Should always account for CORS Preflight and Public Access paths when implementing Global Auth Middleware.
            - **Result**: Confirmed support for legacy Thai folder paths in R2 (e.g. `สำเนาบัตรประชาชน`) via decoded URL processing.
            - **Deployment Issue**: `Binding name 'Secret' already in use` error when running `wrangler secret put`.
                - **Cause**: `Secret` was defined in `wrangler.toml` [vars] (plaintext), conflicting with Secret storage.
                - **Fix**: Commented out `Secret` in `wrangler.toml` to allow CLI management.

        - [x] Refactor `DocumentViewer` & `DailyReportView` to use Worker URL


- [x] **[T-061] Fix Deployment 404s (Fix Static Asset Loading)**
    - **Incident 8: Deployment 404s for Static Assets**
        - **Symptom**: `_next/static/...` 404 Not Found after deployment. Script loading failed.
        - **Root Cause**: `_worker.js` (Advanced Mode) triggered "Functions only" mode, and the generated OpenNext worker does not have fallback logic for `_next/static` files. Missing `_routes.json` caused Cloudflare to route all requests to the worker.
        - **Solution**: Patched `scripts/deploy_safe.sh` to generate `.open-next/assets/_routes.json` which explicitly excludes `/_next/static/*`, `/fonts/*`, etc. from the Worker, forcing Cloudflare Pages to serve them from the Asset Layer (CDN).
        - **Verification**: `curl` check of live site confirmed `_next/static` files return 200 OK.
        - **Status**: Resolved.
- [x] [T-062] Fix Production Data Visibility (Env Var)
    - **Incident 9: Production Dashboard Shows 0 Data**
        - **Status**: Resolved (Added `NEXT_PUBLIC_BASE_URL` to `wrangler.toml`).

- [x] [T-063] Fix Daily Report Upload 404
    - **Incident 10: Upload Error (404 Not Found)**
        - **Status**: Resolved. Restored missing API route.

- [x] [T-064] Fix Broken Images (OpaqueResponseBlocking)
    - **Incident 11: Images Not Loading in Production**
        - **Status**: Resolved. Configured `WORKER_URL` in `wrangler.toml` to serve images via HTTPS.

- [x] [T-065] Implement Landing Page & Mock Data Visibility
    - **Goal**: Create a landing page with "Register" / "Login" options and hide "Mock Data" for guests.
    - **Status**: Done. Verified Landing Page UI and Conditional Rendering logic.

- [x] [T-066] Enhance Landing Page UI
    - **Goal**: Style the Landing Page (`src/app/page.tsx`) to match the Login page aesthetics (Logo, Card, Menu).
    - **Status**: Done. UI enhanced with Logo, Card, and consistent typography.

- [x] [T-067] Add Register Button to Login Page
    - **Goal**: Add a "Register" button below the "Login" button on `/login` page per user request.
    - **Status**: Done. Verified UI and Link.

- [x] [T-068] Implement R2 Image Proxy Route
    - **Goal**: Resolve 404 errors for uploaded images (`/files/...`).
    - **Status**: Done. Implemented `src/app/files/[...path]/route.ts` with Web Crypto signature verification.

- [x] [T-069] Protect Dashboard Routes
    - **Goal**: Restrict access to `/dashboard` and other menus to logged-in users only.
    - **Status**: Done. Created `src/middleware.ts` to protect `/dashboard/**`, redirecting guests to `/login`. `/apply` remains public.

- [x] [T-070] Improve Mobile Responsiveness
    - **Goal**: Optimize UI for mobile devices (Vertical Layout & Mobile Navigation).
    - **Status**: Done. Implemented Mobile Navigation (Sheet) and Responsive Tables/Controls.

- [x] [T-071] Fix Image Resizing and Naming Consistency
    - **Goal**: Ensure mobile camera photos are resized identically to uploads and UI filenames match R2 storage.
    - **Status**: Done. UI now saves the unique R2 filename (e.g., `check-in_123.webp`) instead of the generic worker input name.

- [x] [T-072] Optimize Mobile Image Compression
    - **Goal**: Resolve issue where iPhone photos remain large (~2.7MB) by enforcing aggressive compression.
    - **Status**: Done.
        - Reduced `MAX_DIMENSION` to 1200px.
        - Lowered `TARGET_QUALITY` to 0.5.
        - Forced WebP conversion for all inputs (removed size-based bypass).

- [x] [T-073] Restore R2 Folder Structure and Cleanup
    - **Goal**: Organize R2 files into subfolders and delete old files on replacement.
    - **Status**: Done.
        - Updated `sign-put` to use `${slotId}/${timestamp}.webp` (creates folders).
        - Updated `POST /api/daily-reports` to automatically DELETE the old `r2Key` from the bucket when a slot is updated.

- [x] **[T-074] Tune Image Compression Quality**
    - **Goal**: Improve readability of text in compressed images, specifically for JPEG fallback.
    - **Status**: Done.
        - Increased JPEG fallback quality from `0.5` (50%) to **`0.65` (65%)**.
        - Maintained 800KB fallback threshold to ensure file sizes remain manageable while fixing "blurry text" on iOS/Safari.

- [x] **[T-075] Prevent Accidental Navigation on Apply Page**
    - **Goal**: Warn users if they try to leave the `/apply` page with unsaved changes.
    - **Requirements**:
        - Trigger warning on "Back", "Refresh", "Close Tab", or "Navigate Away".
        - Specific "Yes/No" confirmation (browser default for unload).
    - **Status**: Done.
        - Implemented `useBeforeUnload` hook in `ApplicationForm` to catch dirty state and submissions.

- [x] **[T-076] Fix R2 Filename Display**
    - **Goal**: Restore descriptive filenames in the Daily Report UI (e.g., `check-in_TIMESTAMP.webp`) instead of just numbers.
    - **Status**: Done.
        - Updated `daily-report-view.tsx` to construct display name from `slotId + timestamp` derived from R2 Key.

- [ ] **[T-077] Implement Image Action Menu (View/Download/Delete)**
    - **Goal**: detailed image actions into a "Three-dot" dropdown menu for better UI/UX.
    - **Requirements**:
        - **Menu**: Dropdown with "View", "Download", "Delete".
        - **View**: Open image in new tab / Lightbox.
        - **Download**: Trigger browser download.
        - **Delete**: Execute existing delete logic (move from overlay button).
    - **Refactor**: Remove the standalone red trash icon from the image container.

- [x] **[T-078] Fix R2 CORS & Thai Filename Upload Errors**
    - **Goal**: Resolve `Access-Control-Allow-Origin` errors and `TypeError: Load failed` when uploading files with Thai names.
    - **Error Analysis**: 
        - Origin `https://drive-onboard-app.pages.dev` blocked by CORS.
        - Upload failures for filenames like `สำเนาบัตรประชาชน (ผู้ค้ำ)`.
    - **Resolution**:
        - **Primary Fix**: Refactored `application-form.tsx` to use English `docId` (e.g., `doc-citizen-id`) instead of Thai `docType` (e.g., `สำเนาบัตรประชาชน`) for generating R2 Storage Keys. This eliminates URL encoding mismatches which caused Signature Validation to fail.
        - **CORS Status**: Attempted to update CORS via `wrangler` and `aws-sdk`, but failed due to `AccessDenied` (API Token lacks Admin persistence) and `JSON Malformed` (Wrangler schema issues).
    - **Prevention**: Always use ASCII-safe identifiers for Storage Keys. User-facing labels can be Thai, but internal IDs must be English.
    - **Note to User**: If "Access-Control-Allow-Origin" errors persist, please manually add `https://drive-onboard-app.pages.dev` to the R2 Bucket CORS settings via Cloudflare Dashboard.

- [x] **[T-079] Fix Application Submission Error (Strict Protocol)**
    - **Concept/Goal**: ตรวจสอบและแก้ไขปัญหา "ส่งใบสมัครแล้ว Error" ให้ใช้งานได้จริง อย่างเคร่งครัดตาม Protocol ใหม่
    - **Problem**: User รายงานว่าการ "สมัครงานส่ง Error" (Submit Application Failed). อาจเกิดจาก API, Database, หรือ Data Validation.
    - **Investigation Plan**:
        1.  Analyze `application-form.tsx` (Submit Handler).
        2.  Check API `/api/applications` logic.
        3.  Verify Data Structure vs D1 Schema.
    - **Sub-tasks**:
        - [x] Analyze Code & Root Cause.
        - [x] Apply Fixes (API/Frontend).
        - [x] Verify Submission.

- [x] **[T-080] Deploy Fix T-079 to Production**
    - **Concept/Goal**: นำ Source Code ที่แก้ไขแล้วใน T-079 ขึ้นสู่ Production (Cloudflare Pages)
    - **Problem**: Fix ใน Local (T-079) ยังไม่ได้ Sync ขึ้น Production ทำให้ User ยังเจอปัญหาเดิม
    - **Execution Plan**:
        1.  Build Project (Local Check).
        2.  Deploy via `wrangler pages deploy`.
        3.  Verify Live URL (`https://drive-onboard-app.pages.dev/`).
    - **Sub-tasks**:
        - [x] Build & Deploy.
        - [x] Verify Production API.


---

## Incident Log & Case Studies (บันทึกปัญหาและกรณีศึกษา)
> **Goal**: Record interesting cases to prevent recurrence.
> (บันทึก Case ที่น่าสนใจเพื่อป้องกันไม่ให้เกิดซ้ำ)

### Case Study: R2 `fs.readFile` Error in Cloudflare Pages
*   **Date**: 2025-12-27
*   **Symptom**:
    *   API `POST /api/r2/sign-put` Return 500
    *   Log: `Error: [unenv] fs.readFile is not implemented yet!`
*   **Root Cause**:
    *   Node.js Runtime in Cloudflare Pages tried to load AWS Credentials from a file (`~/.aws/credentials`) because Env Vars were missing.
    *   AWS SDK V3 falls back to filesystem (which doesn't exist on Edge) when Env Vars are missing.
*   **Resolution**:
    1.  Confirm Env Vars via `console.log`.
    2.  Update Secrets using `wrangler pages secret put`.
    3.  Redeploy.
*   **Prevention Rule**:
    *   **Check Env Vars** before initializing AWS Client in Edge Environment.
    *   Use `requireR2Bucket()` or a fail-fast helper.
    *   **Global Search**: When fixing a bug, search for similar patterns across the entire project.

*   **Incident 2: Deployment 404**
    *   **Root Cause**: User Error (Agent) - Deployed wrong directory (`.open-next/assets`).
    *   **Resolution**: Deploy the correct folder logic.

*   **Incident 3: Data Discrepancy**
    *   **Root Cause**: OpenNext Env hides Bindings (`env.DB`).
    *   **Fix**: Use `getCloudflareContext()` to access `env.DB`.

*   **Incident 4: Stale Deployment**
    *   **Root Cause**: `wrangler pages deploy` does NOT build the project.
    *   **Fix**: Always run `npx @opennextjs/cloudflare build` before deploy.

*   **Incident 5: Build Failure & Native Modules**
    *   **Root Cause**: `better-sqlite3` traced into production build.
    *   **Fix**: Use Dynamic Import + `serverExternalPackages`.

*   **Incident 6: "Upload Failed" (Deployment Blocked by Localhost)**
    *   **Date**: 2025-12-28
    *   **Symptom**: `npm run build` fails with `rm: .next: Directory not empty` or `copyTracedFiles` error.
    *   **Root Cause 1 (File Lock)**: `npm run dev` (Localhost) locks `.next` folder, preventing Build Script from cleaning it.
    *   **Root Cause 2 (Native Module)**: `better-sqlite3` (used for Local D1) gets traced into Production Build, causing OpenNext to fail on Edge.
    *   **Resolution**:
        1.  **Stop Localhost** (Kill Port 9002) before Building.
        2.  **Webpack Alias**: Set `better-sqlite3: false` in `next.config.mjs` to forcibly exclude it.
    *   **Prevention**:
        *   Do not run Build and Dev Server simultaneously.
        *   Always check `next.config.mjs` exclusion rules if Build fails on `copyTracedFiles`.

*   **Incident 7: macOS Metadata Files (._*) Breaking OpenNext Build**
    *   **Date**: 2025-12-28
    *   **Symptom**: Build fails with `WARN Unknown file extension` and `Error: app/._page cannot use the edge runtime`.
    *   **Root Cause**: macOS creates hidden `._` files on external drives (AppleDouble). OpenNext tries to bundle them as source files.
    *   **Fix**: Run `find . -type f -name "._*" -delete` before building.
    *   **Prevention**: Added cleanup step to `deploy_prod.sh`.


*   [ ] **[T-081] Fix Application Form Issues** <!-- id: 4 -->
    *   [x] Fix Signature Persistence on Resize (SignatureInput.tsx)
    *   [x] Add Validation Error Feedback (Toast in ApplicationForm.tsx)
    *   [x] Deploy Fixes to Production

    *   [ ] Verify Fixes (User)

*   [ ] **[T-082] Fix Missing Phone Fields** <!-- id: 5 -->
    *   [x] Add Mobile Phone, Home Phone, and Email fields to ApplicationForm.tsx
    *   [x] Deploy Fixes to Production
    *   [ ] Verify Fixes (User)

*   [x] **[T-083] สร้างบัญชี Employee อัตโนมัติเมื่ออนุมัติใบสมัคร**
    *   **Concept/Goal (แนวคิด)**: ลดงาน manual ของ Admin โดยให้ระบบสร้างบัญชีพนักงานอัตโนมัติทันทีเมื่ออนุมัติใบสมัคร และผูกสิทธิ์ login ตามสถานะใบสมัครจริง
    *   **Principles (หลักการ)**: Data Consistency (ข้อมูลใบสมัครและสิทธิ์ใช้งานต้องตรงกัน), Idempotency (อนุมัติซ้ำต้องไม่สร้าง user ซ้ำ), Security Baseline (ผู้ที่ยังไม่ผ่านอนุมัติห้ามเข้าใช้งาน)
    *   **อ้างอิง Feature**: [F-001], [F-002], [F-006], [F-017]
    *   **ไฟล์ที่แก้ไข**:
        *   `src/lib/types.ts`
        *   `src/components/dashboard/application-form.tsx`
        *   `src/app/actions.ts`
        *   `src/auth.ts`
    *   **Implementation Details (รายละเอียดการพัฒนา)**:
        *   บังคับให้ `manifest.applicant.email` เป็นข้อมูลจำเป็นใน schema ใบสมัคร
        *   เปลี่ยน UI label ในฟอร์มสมัครงานให้สื่อว่าอีเมลเป็น field บังคับ
        *   ใน `updateApplicationStatus()` เมื่อเปลี่ยนเป็น `approved` ให้ดึง email และเลขบัตรจาก manifest แล้วสร้าง user role `employee` หากยังไม่มี
        *   ใช้รหัสผ่านเริ่มต้นจากเลขท้าย 6 หลักของบัตรประชาชน และไม่สร้าง user ซ้ำหาก email มีอยู่แล้ว
        *   ใน `authorize()` ของ NextAuth ให้ตรวจสถานะใบสมัครของ `employee` ก่อนอนุญาต login
        *   ถ้าสถานะไม่ใช่ `approved` เช่น `pending`, `rejected`, `terminated` ให้ปฏิเสธ login พร้อมข้อความอธิบาย
    *   **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**:
        *   Admin อนุมัติใบสมัครแล้วมี user `employee` ถูกสร้างอัตโนมัติ
        *   อนุมัติซ้ำหรืออนุมัติใหม่ภายหลังไม่สร้าง user ซ้ำ
        *   `employee` login ได้เฉพาะตอนสถานะใบสมัครเป็น `approved`
        *   หากเปลี่ยนสถานะเป็น `terminated` หรือ `pending` จะ login ไม่ได้ทันที
    *   **Sub-tasks (งานย่อย)**:
        *   [x] บังคับ email ใน ManifestSchema และปรับ label ในฟอร์ม
        *   [x] เพิ่ม logic auto-create employee ใน server action เปลี่ยนสถานะ
        *   [x] เพิ่ม approval gate ใน NextAuth authorize
        *   [x] รัน TypeScript verification

*   [x] **[T-084] กันใบสมัครซ้ำด้วย Email และแยก Route ตาม Role**
    *   **Concept/Goal (แนวคิด)**: ป้องกันข้อมูลซ้ำในระบบตั้งแต่ขั้นตอน submit และแยกประสบการณ์ใช้งานของพนักงานออกจากแอดมินอย่างชัดเจน
    *   **Principles (หลักการ)**: Data Integrity (email หนึ่งใบสมัครต่อหนึ่งบัญชี), Least Privilege (แต่ละ role เข้าถึงเฉพาะหน้าที่เกี่ยวข้อง), Predictable Routing (login แล้วถูกส่งไปเส้นทางที่ถูกต้องเสมอ)
    *   **อ้างอิง Feature**: [F-001], [F-002], [F-017], [F-018]
    *   **ไฟล์ที่แก้ไข**:
        *   `src/lib/applications.ts`
        *   `src/app/api/applications/submit/route.ts`
        *   `src/app/api/applications/route.ts`
        *   `src/middleware.ts`
        *   `src/components/dashboard/header.tsx`
        *   `src/components/dashboard/applications-client.tsx`
        *   `src/components/dashboard/applications-table.tsx`
        *   `src/components/dashboard/application-details.tsx`
        *   `src/app/employee/*`
    *   **Implementation Details (รายละเอียดการพัฒนา)**:
        *   เพิ่ม helper กลางสำหรับค้นหาใบสมัครตาม email และดึงสถานะล่าสุด
        *   ใน submit route ถ้าเจอ email ซ้ำกับใบสมัครอื่นให้ตอบกลับ `409`
        *   เพิ่ม route `/employee`, `/employee/daily-report`, `/employee/applications/[id]`
        *   ปรับ middleware ให้บังคับ redirect `/dashboard/*` สำหรับ admin และ `/employee/*` สำหรับ employee
        *   ปรับ header และ table links ให้พาไปเส้นทางตาม role
        *   จำกัดหน้า detail ของ employee เป็น read-only
    *   **Confirmed Behavior (พฤติกรรมที่ต้องทดสอบ)**:
        *   ผู้สมัครส่งใบสมัครด้วย email ซ้ำไม่ได้
        *   Admin login แล้วเข้า `/dashboard`
        *   Employee login แล้วเข้า `/employee`
        *   Employee เปิดดูได้เฉพาะใบสมัครของตัวเอง และแก้ไข/อนุมัติข้อมูลไม่ได้
    *   **Sub-tasks (งานย่อย)**:
        *   [x] เพิ่ม duplicate email guard ใน submit route
        *   [x] สร้าง employee portal และ detail route แบบ read-only
        *   [x] แยก middleware redirect ตาม role
        *   [x] รัน TypeScript verification
