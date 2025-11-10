import type { Operation } from 'fast-json-patch';

export interface PresetJson {
  metadata: Record<string, unknown>;
  data: unknown;
}

export interface UnpackResponse extends PresetJson {
  filename: string;
}

export interface ModifyResponse {
  patch: Operation[];
  patchedJson: PresetJson;
  diff: unknown;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function uploadPreset(file: File): Promise<UnpackResponse> {
  const formData = new FormData();
  formData.append('preset', file);
  const response = await fetch('/api/unpack', {
    method: 'POST',
    body: formData
  });
  return handleResponse<UnpackResponse>(response);
}

export async function modifyPreset(payload: {
  json: PresetJson;
  instruction: string;
}): Promise<ModifyResponse> {
  const response = await fetch('/api/modify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<ModifyResponse>(response);
}

export async function packPreset(payload: {
  json: PresetJson;
  filename?: string;
}): Promise<Blob> {
  const response = await fetch('/api/pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.blob();
}
