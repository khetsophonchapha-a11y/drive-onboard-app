# Requirement Traceability Matrix (ตารางตรวจสอบความครบถ้วน)

ตารางนี้ใช้สำหรับติดตามว่าแต่ละ Feature (F-XXX) ถูกพัฒนาเป็น Task (T-XXX) ใด และอยู่ในไฟล์ไหน

| Feature ID | Spec Header | Tasks | Key Code Files | Status |
| :--- | :--- | :--- | :--- | :--- |
| **[F-001]** | Admin Authentication (ระบบล็อกอินแอดมิน) | [T-010] | `src/auth.ts`, `.env.local` | Done (เสร็จแล้ว) |
| **[F-002]** | Driver App Form (ฟอร์มใบสมัครคนขับ) | [T-011], [T-020], [T-047], [T-079], [T-080] | `src/app/driver/*`, `src/app/api/applications/*`, `docs/d1-summary.sql` | Done (Merged) <br> *Strict Protocol Fix applied* |
| **[F-003]** | Document Upload R2 (อัปโหลดเอกสาร) | [T-012], [T-048], [T-049], [T-050] | `src/lib/r2.ts`, `docs/worker-d1-summary.js` | Done (เสร็จแล้ว) <br> *Fix: CORS & Auth logic for /files/* <br> *Support: English (new) & Thai (legacy) folder paths* |
| **[F-004]** | Completeness Check (เช็คความครบถ้วน) | [T-021] | `src/lib/validation.ts` | Planned (วางแผน) |
| **[F-005]** | Verification Workflow (ระบบตรวจสอบ) | [T-022] | `src/app/admin/verify/page.tsx` | Planned (วางแผน) |
| **[F-006]** | Status Management (จัดการสถานะ) | [T-022] | `src/lib/status.ts` | Planned (วางแผน) |
| **[F-007]** | AI Analysis Tool (AI วิเคราะห์) | [T-030] | `src/ai/dev.ts` | Planned (วางแผน) |
| **[F-008]** | Performance Tuning (ปรับจูนระบบ) | [T-042] | `src/components/daily-report/*` | Done (เสร็จแล้ว) <br> *Note: ระวังเรื่อง Prop mismatch และ MD5 calculation order* |
| **[F-009]** | Security Cleanup (ความปลอดภัย) | [T-043] | `src/auth.ts` | Done (เสร็จแล้ว) |
| **[F-010]** | Daily Report Review (ตรวจรายงาน) | [T-023], [T-024], [T-026] | `src/components/daily-report-overview/*` | Phase 2 Done, Bug Fixing |
| **[F-011]** | Data Export (ส่งออกข้อมูล) | [T-025] | `dashboard/daily-report-tracker.tsx` | Done (เสร็จแล้ว) |
| **[F-012]** | Idle Timeout Protection (ระบบล็อคเมื่อไม่ใช้งาน) | [T-045] | `components/idle-lock.tsx` | Done (เสร็จแล้ว) |
| **[F-013]** | Dashboard UX Refinement (ปรับปรุงการใช้งาน Dashboard) | [T-046], [T-068] | `components/dashboard/daily-report-tracker.tsx` | Done (เสร็จแล้ว) |
| **[F-014]** | Mobile Responsiveness (รองรับมือถือ) | [T-069], [T-070] | `components/dashboard/*`, `applications-table.tsx` | Done (เสร็จแล้ว) <br> *Fix: Menu, Tables, Overflow* |
| **[F-015]** | Image Optimization (จัดการรูปภาพ) | [T-071], [T-072], [T-073], [T-074] | `workers/image-processor.ts`, `api/daily-reports/*` | Done (เสร็จแล้ว) <br> *Key: WebP/JPG Auto, Folders, Cleanup* |
| **[F-016]** | Apply Page Safety (ป้องกันข้อมูลหาย) | [T-075] | `components/dashboard/application-form.tsx` | Done (เสร็จแล้ว) |

## Data/Variable Traceability (โครงข่ายตัวแปรและแหล่งข้อมูล)
ตารางนี้ใช้ Map ระหว่าง Entity <-> ตัวแปรใน Code เพื่อให้ง่ายต่อการ Debug และพัฒนาต่อ

| ข้อมูลหลัก (Entity) | ชื่อ Interface/Type | ตัวแปร State หลัก (Key State Variables) | ไฟล์ที่เกี่ยวข้อง (Related Files) | หมายเหตุ (Notes) |
| :--- | :--- | :--- | :--- | :--- |
| **Application** | `AppRow` | `applications`, `filteredApplications` | `dashboard/applications-client.tsx`, `lib/types.ts` | ใช้ `D1` เป็นหลัก |
| **User** | `User` | `user` | `hooks/use-auth.ts`, `src/auth.ts` | Role-based (admin/user) |
| **DailyReport** | `DailyReportResponse` | `report`, `reportCache` | `daily-report/daily-report-view.tsx`, `lib/daily-report.ts` | มี LRU Cache |
| **DailyReportSlot** | `DailyReportResponseSlot` | `slots` | `daily-report/daily-report-view.tsx` | ใช้ `id` เป็น Key |
| **DailyReportSummary** | `DailyReportSummaryRow` | `rows`, `filteredRows` | `dashboard/daily-report-tracker.tsx`, `lib/daily-report.ts` | หน้า Overview |

## Component Registry (ทะเบียนส่วนประกอบ) [C-XXX]
ตารางนี้ใช้สำหรับลงทะเบียน Component ที่ถูกใช้งานบ่อย (Reusable) เพื่อให้อ้างอิงได้ง่าย

| Component ID | Component Name | File Path | Usage Context | Related Feature |
| :--- | :--- | :--- | :--- | :--- |
| **[C-UI-001]** | IdleLockScreen | `src/components/ui/idle-lock-screen.tsx` | Global Overlay (Security) | [F-012] |
| **[C-DASH-001]** | DailyReportTracker | `src/components/dashboard/daily-report-tracker.tsx` | Overview Page (Table) | [F-010], [F-013] |
| **[C-DASH-002]** | ApplicationForm | `src/components/dashboard/application-form.tsx` | Apply Page (Wizard) | [F-002], [F-016] |
| **[C-DASH-003]** | ApplicationDetails | `src/components/dashboard/application-details.tsx` | Admin Verify Page | [F-002], [F-003] |
| **[C-DASH-004]** | ApplicationsTable | `src/components/dashboard/applications-table.tsx` | Application List | [F-002], [F-014] |
| **[C-DASH-005]** | UsersTable | `src/components/dashboard/users-table.tsx` | User Management | [F-001] |
| **[C-DASH-006]** | UserForm | `src/components/dashboard/user-form.tsx` | Create/Edit User | [F-001] |
| **[C-DASH-007]** | DocumentViewer | `src/components/dashboard/document-viewer.tsx` | Shared (Image/PDF) | [F-003], [F-015] |
| **[C-DASH-008]** | Header | `src/components/dashboard/header.tsx` | Admin Layout | Navigation |
| **[C-DASH-009]** | SidebarNav | `src/components/dashboard/sidebar-nav.tsx` | Admin Layout | Navigation |
| **[C-DASH-010]** | DashboardTabs | `src/components/dashboard/dashboard-tabs.tsx` | Dashboard (Segmented Control) | Layout |
| **[C-DASH-011]** | OverviewCards | `src/components/dashboard/overview-cards.tsx` | Dashboard (Stats) | [F-010] |
| **[C-REP-001]** | DailyReportView | `src/components/daily-report/daily-report-view.tsx` | Edit Popup & Page | [F-010], [F-008] |
| **[C-REP-002]** | DailyReportSlotCard | `src/components/daily-report/daily-report-slot-card.tsx` | Single Time Slot | [F-010] |

