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
  analysis: z.string().describe('The analysis of why the form is incomplete.'),
  instructions: z.string().describe('Specific instructions for the applicant to complete the form accurately.'),
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
  prompt: `You are an expert AI assistant specializing in analyzing incomplete application forms.  You are provided the application schema, the filled in form data, and document uploads from the user.  You will:

1.  Analyze the application form schema.
2.  Inspect the filled in form data, and determine what is missing and incorrect.
3.  Analyze the document uploads from the user, and use them to augment the analysis in step 2.
4.  Provide a detailed analysis of why the form is incomplete.
5.  Based on the analysis, generate specific instructions for the applicant to complete the application accurately.

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
