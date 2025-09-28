'use server';
/**
 * @fileOverview A flow for generating unique charge codes.
 *
 * - generateChargeCodes - A function that generates a specified number of unique charge codes with a given value.
 * - GenerateChargeCodesInput - The input type for the generateChargeCodes function.
 * - GenerateChargeCodesOutput - The return type for the generateChargeCodes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateChargeCodesInputSchema = z.object({
  count: z.number().int().positive().describe('The number of charge codes to generate.'),
  amount: z.number().positive().describe('The monetary value for each charge code.'),
});
export type GenerateChargeCodesInput = z.infer<typeof GenerateChargeCodesInputSchema>;

const GenerateChargeCodesOutputSchema = z.object({
    codes: z.array(z.string()).describe('An array of unique, generated charge codes.'),
});
export type GenerateChargeCodesOutput = z.infer<typeof GenerateChargeCodesOutputSchema>;


export async function generateChargeCodes(input: GenerateChargeCodesInput): Promise<GenerateChargeCodesOutput> {
  return generateChargeCodesFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateChargeCodesPrompt',
  input: { schema: GenerateChargeCodesInputSchema },
  output: { schema: GenerateChargeCodesOutputSchema },
  prompt: `You are a secure code generation system. Your task is to generate a list of unique, random, and hard-to-guess charge codes.

Instructions:
1. Generate exactly {{{count}}} unique codes.
2. The codes should be alphanumeric (containing both letters and numbers).
3. The codes should be 8 characters long.
4. The codes must be in all uppercase.
5. Do not include special characters.
6. Ensure there are no duplicates in the generated list.

Generate the list of codes based on the requested count. The value of these codes will be {{{amount}}}, but you only need to generate the code strings themselves.`,
});


const generateChargeCodesFlow = ai.defineFlow(
  {
    name: 'generateChargeCodesFlow',
    inputSchema: GenerateChargeCodesInputSchema,
    outputSchema: GenerateChargeCodesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate charge codes.');
    }
    // Ensure uniqueness, although the prompt requests it, this is a safeguard.
    const uniqueCodes = [...new Set(output.codes)];
    return { codes: uniqueCodes };
  }
);
