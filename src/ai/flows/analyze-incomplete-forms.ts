'use server';

/**
 * @fileOverview An AI agent for analyzing incomplete driver application forms.
 *
 * - analyzeIncompleteForm - A function that analyzes incomplete forms and generates instructions.
 * - AnalyzeIncompleteFormInput - The input type for the analyzeIncompleteForm function.
 * - AnalyzeIncompleteFormOutput - The return type for the analyzeIncompleteForm function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeIncompleteFormInputSchema = z.object({
  documentDataUris: z
    .array(z.string())
    .describe(
      'An array of document images as data URIs that must include a MIME type and use Base64 encoding. Expected format: [data:<mimetype>;base64,<encoded_data>].'
    ),
  applicationFormSchema: z.string().describe('The JSON schema of the application form.'),
  filledFormData: z.string().describe('The filled data in the application form as a JSON string.'),
});
export type AnalyzeIncompleteFormInput = z.infer<typeof AnalyzeIncompleteFormInputSchema>;

const AnalyzeIncompleteFormOutputSchema = z.object({
  analysis: z.string().describe('การวิเคราะห์ว่าทำไมฟอร์มถึงไม่สมบูรณ์ (ภาษาไทย)'),
  instructions: z.string().describe('คำแนะนำที่เฉพาะเจาะจงสำหรับผู้สมัครเพื่อกรอกฟอร์มให้ถูกต้อง (ภาษาไทย)'),
});
export type AnalyzeIncompleteFormOutput = z.infer<typeof AnalyzeIncompleteFormOutputSchema>;

export async function analyzeIncompleteForm(
  input: AnalyzeIncompleteFormInput
): Promise<AnalyzeIncompleteFormOutput> {
  return analyzeIncompleteFormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeIncompleteFormPrompt',
  input: {
    schema: AnalyzeIncompleteFormInputSchema,
  },
  output: {
    schema: AnalyzeIncompleteFormOutputSchema,
  },
  prompt: `คุณคือผู้ช่วย AI ผู้เชี่ยวชาญด้านการวิเคราะห์แบบฟอร์มใบสมัครที่ไม่สมบูรณ์ คุณจะได้รับข้อมูล 3 ส่วน: schema ของฟอร์มใบสมัคร, ข้อมูลที่ผู้สมัครกรอก, และไฟล์เอกสารที่อัปโหลดมา
หน้าที่ของคุณคือ:

1.  วิเคราะห์ schema ของฟอร์มใบสมัครเพื่อทำความเข้าใจโครงสร้างและข้อกำหนดทั้งหมด
2.  ตรวจสอบข้อมูลที่ผู้สมัครกรอก (Filled Form Data) เทียบกับ schema เพื่อระบุว่ามีข้อมูลใดขาดหายไปหรือไม่ถูกต้อง
3.  วิเคราะห์รูปภาพเอกสารที่อัปโหลดมา (Uploaded Documents) เพื่อตรวจสอบว่ามีข้อมูลที่สามารถนำมาเติมเต็มส่วนที่ขาดในข้อ 2 ได้หรือไม่ และตรวจสอบคุณภาพของเอกสาร
4.  สรุปผลการวิเคราะห์เป็น "บทวิเคราะห์" (analysis) ที่ชัดเจนถึงสาเหตุที่ทำให้ใบสมัครนี้ยังไม่สมบูรณ์
5.  จากบทวิเคราะห์ในข้อ 4 ให้สร้าง "คำแนะนำ" (instructions) ที่สุภาพและเป็นขั้นตอนสำหรับผู้สมัคร เพื่อให้พวกเขาสามารถกลับไปแก้ไขและส่งเอกสารให้ครบถ้วนถูกต้อง

สำคัญ: ผลลัพธ์ทั้งหมด (analysis และ instructions) จะต้องเป็นภาษาไทยเท่านั้น

Application Form Schema: {{{applicationFormSchema}}}
Filled Form Data: {{{filledFormData}}}
Uploaded Documents: {{#each documentDataUris}} {{media url=this}} {{/each}}`,
});

const analyzeIncompleteFormFlow = ai.defineFlow(
  {
    name: 'analyzeIncompleteFormFlow',
    inputSchema: AnalyzeIncompleteFormInputSchema,
    outputSchema: AnalyzeIncompleteFormOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
