# AI Implementation Protocol (Standard Operating Procedure)

คู่มือการปฏิบัติงานสำหรับ AI (Agent) เพื่อให้การพัฒนาเป็นไปอย่างมีระบบ เคร่งครัด และตรวจสอบได้ (Chain of Thought Compliance)

---

## 1. Context Loading (การโหลดข้อมูลบริบทเริ่มต้น)
> **Mandatory Action**: เมื่อเริ่ม Session ใหม่ หรือได้รับงานใหม่ **ต้องอ่านไฟล์เหล่านี้ทั้งหมดก่อนเสมอ** ห้ามข้ามเด็ดขาด
> (Must read all these files to establish full context before doing anything.)

1.  **`SpecKit/instruction.md` (Blueprint & Structure)**
    *   **Purpose**: เข้าใจ Environment, Tech Stack, Directory Structure, และ Coding Standards
    *   **Focus**: ตรวจสอบว่าต้องเขียน code ภาษาอะไร โครงสร้างวางไว้ที่ไหน และมีกฎข้อห้ามอะไรบ้าง

2.  **`SpecKit/spec.md` (Features & Requirements)**
    *   **Purpose**: เข้าใจ Feature ทั้งหมดของระบบในรูปแบบ `[F-xxx]` และ Feature ย่อย
    *   **Focus**: ตรวจสอบว่าสิ่งที่กำลังจะทำ สอดคล้องกับ Feature เดิม หรือเป็น Feature ใหม่ที่ต้องบันทึกเพิ่ม

3.  **`SpecKit/task.md` (Execution Roadmap)**
    *   **Purpose**: ดูสถานะปัจจุบันและแผนงานการพัฒนาแบบละเอียด (Step-by-Step) ในรูปแบบ `[T-xxx]`
    *   **Focus**: เข้าใจงานที่ค้างอยู่ (Pending) และงานที่ต้องทำต่อ เพื่อให้ Agent ตัวอื่นสามารถทำงานต่อได้ทันที

4.  **`SpecKit/traceability.md` (Matrix & Data Map)**
    *   **Purpose**: แผนที่ความเชื่อมโยงระหว่าง `[F-xxx]` <-> `[T-xxx]` <-> `Code Files` <-> `Variables`
    *   **Focus**: ตรวจสอบผลกระทบ (Impact Analysis) ว่าการแก้ไขตัวแปรหรือ Component หนึ่ง จะกระทบไฟล์ไหนบ้าง

---

## 2. Planning & Task Definition (การวางแผนและแตกงาน)
> **Action**: หลังจากรับโจทย์และเข้าใจ Context จากข้อ 1 แล้ว ให้ทำการวางแผนลงในเอกสาร **ก่อนเริ่มเขียนโค้ด**

1.  **Analyze Request**: 
    *   วิเคราะห์โจทย์ด้วย Chain of Thought (CoT) ว่าต้องทำอะไรบ้าง กระทบส่วนไหน
    *   (Analyze the request: What needs to be done? What is the impact?)

2.  **Update `SpecKit/task.md`**:
    *   สร้าง Task ใหม่ในรูปแบบ `[T-xxx]`
    *   เขียนแผนการทำงานอย่างละเอียด (Step-by-step)
    *   ระบุชื่อไฟล์และ Path ที่จะสร้างหรือแก้ไขให้ชัดเจน
    *   อ้างอิง `[F-xxx]` จาก `spec.md` ที่เกี่ยวข้อง
    *   อ้างอิง Variables/Components จาก `traceability.md` ที่เกี่ยวข้อง
    *   **New Requirement**: หากมีการสร้างหรือแก้ไข Component สำคัญ ให้กำหนดรหัส `[C-xxx]` และเพิ่มลงใน `traceability.md` เพื่อใช้อ้างอิงทั้ง Project
    *   **Language**: **ต้องใช้ภาษาไทย** ในการอธิบายแผนงานและรายละเอียด

3.  **Update `SpecKit/spec.md`** (If New Feature):
    *   ถ้าเป็นฟีเจอร์ใหม่ ให้เพิ่ม `[F-xxx]` ใหม่ลงใน `spec.md`

---

## 3. Execution (การลงมือปฏิบัติ)
> **Action**: ดำเนินการตามแผนที่วางไว้ใน `SpecKit/task.md` อย่างเคร่งครัด ทีละขั้นตอน

1.  **Sequential Execution**: ทำทีละ Sub-task ที่ระบุไว้ ห้ามข้ามขั้นตอน
2.  **Verification**: ตรวจสอบผลลัพธ์ในแต่ละขั้นตอนก่อนไปต่อ
3.  **Strict Adherence**: ปฏิบัติตามมาตรฐานที่ระบุใน `instruction.md` (เช่น การตั้งชื่อไฟล์, Code Style)

---

## 4. Finalization & Documentation (การสรุปและอัปเดตเอกสาร)
> **Action**: เมื่อทำงานเสร็จสิ้น หรือจบแต่ละขั้นตอนย่อย ต้องอัปเดตเอกสารให้เป็นปัจจุบัน

1.  **Mark Complete**: เปลี่ยนสถานะ Task ใน `SpecKit/task.md` เป็น `[x]`
2.  **Update `SpecKit/traceability.md`**:
    *   บันทึกความเชื่อมโยงใหม่ที่เกิดขึ้น (Code File -> Feature -> Task)
    *   **Components**: เพิ่มหรืออัปเดต Component ใหม่ในตารางด้วยรหัส `[C-xxx]`
    *   อัปเดต Variable Map หากมีการเพิ่ม/ลบ/แก้ไขตัวแปรสำคัญ
3.  **Language Requirement**:
    *   การตอบโต้กับ User และการเขียนบันทึกในเอกสาร (Log/Summary) **ต้องใช้ภาษาไทย** เพื่อความเข้าใจที่ตรงกันของทีมงาน

---
**Core Principle**: "เอกสารคือนำทาง โค้ดคือผลลัพธ์ รักษาเอกสารให้เหมือนรักษาชีวิต"
