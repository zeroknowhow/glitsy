import 'dotenv/config';
import type { Operation } from 'fast-json-patch';

export type Rfc6902Patch = Operation[];

const SYSTEM_PROMPT = `You are a meticulous audio synthesizer technician. Given the current Serum preset JSON and a natural-language instruction, respond with a valid RFC 6902 JSON Patch array that performs the requested edits.

Rules:
- Output only JSON: the top-level value must be an array of patch operations.
- Prefer conservative "replace" operations over add/remove unless explicitly required.
- Never guess about undocumented keys; leave unknown fields untouched.
- Do not modify values when the instruction is unclear.
- Each operation must target an existing JSON Pointer path unless you are certain the instruction requires creating a new field.
- Validate that numeric strings remain numeric numbers and booleans remain booleans.
`;

interface OpenAIChatCompletion {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

function parsePatchResponse(content: string | null): Rfc6902Patch {
  if (!content) {
    return [];
  }

  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('LLM response did not contain a JSON array.');
  }

  const jsonText = content.slice(start, end + 1);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error('Parsed patch was not an array.');
  }
  return parsed as Rfc6902Patch;
}

export async function proposePatch(json: unknown, instruction: string): Promise<Rfc6902Patch> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!instruction.trim()) {
    return [];
  }

  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set; returning no-op patch.');
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            instruction,
            json
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as OpenAIChatCompletion;
  const content = data.choices?.[0]?.message?.content ?? null;
  if (!content) {
    return [];
  }

  try {
    const parsed = parsePatchResponse(content);
    return parsed;
  } catch (error) {
    console.error('Failed to parse LLM patch response:', error);
    throw error;
  }
}
