import { pack, unpack } from 'node-serum2-preset-packager';

export interface UnpackedPreset {
  metadata: Record<string, unknown>;
  data: unknown;
}

export async function unpackPreset(buffer: Buffer): Promise<UnpackedPreset> {
  const result = await unpack(buffer);
  return {
    metadata: result.metadata ?? {},
    data: result.data
  };
}

export async function packPreset(json: UnpackedPreset): Promise<Buffer> {
  return pack({
    metadata: json.metadata,
    data: json.data
  });
}
