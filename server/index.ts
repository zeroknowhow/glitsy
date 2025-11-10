import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { create as createDiffPatcher } from 'jsondiffpatch';
import { unpackPreset, packPreset } from './packager.js';
import { proposePatch } from './llm.js';
import {
  validatePatchStructure,
  validatePatchSemantics,
  applyPatchWithValidation
} from './validate.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.serumpreset')) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'));
    }
    cb(null, true);
  }
});

const diffpatcher = createDiffPatcher({ objectHash: (item: any) => item?.id ?? JSON.stringify(item) });

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

const modifySchema = z.object({
  json: z.object({
    metadata: z.record(z.unknown()),
    data: z.unknown()
  }),
  instruction: z.string().min(1, 'Instruction must not be empty')
});

const packSchema = z.object({
  json: z.object({
    metadata: z.record(z.unknown()),
    data: z.unknown()
  }),
  filename: z.string().optional()
});

app.post(
  '/api/unpack',
  upload.single('preset'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No preset file provided.' });
      return;
    }

    try {
      const unpacked = await unpackPreset(file.buffer);
      res.json({
        metadata: unpacked.metadata,
        data: unpacked.data,
        filename: file.originalname
      });
    } catch (error) {
      console.error('Failed to unpack preset:', error);
      res.status(415).json({ error: 'Unable to unpack preset. Ensure the file is a valid Serum 2 .SerumPreset.' });
    }
  })
);

app.post(
  '/api/modify',
  asyncHandler(async (req, res) => {
    const parsed = modifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { json, instruction } = parsed.data;
    const patch = await proposePatch(json, instruction);

    try {
      const validatedPatch = validatePatchStructure(patch);
      validatePatchSemantics(json, validatedPatch);
      const patchedJson = applyPatchWithValidation(json, validatedPatch);
      const diff = diffpatcher.diff(json, patchedJson) ?? null;
      res.json({ patch: validatedPatch, patchedJson, diff });
    } catch (error) {
      console.error('Failed to apply patch:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid patch operations returned by LLM.',
        patch
      });
    }
  })
);

app.post(
  '/api/pack',
  asyncHandler(async (req, res) => {
    const parsed = packSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { json, filename } = parsed.data;

    try {
      const buffer = await packPreset(json);
      const safeName = filename?.replace(/[^a-z0-9-_]/gi, '_') || 'edited-preset';
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.SerumPreset"`);
      res.send(buffer);
    } catch (error) {
      console.error('Failed to pack preset:', error);
      res.status(400).json({ error: 'Unable to pack preset. Ensure the JSON structure is valid.' });
    }
  })
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Preset file is too large. Maximum size is 25MB.' });
      return;
    }
    res.status(415).json({ error: 'Only .SerumPreset files are accepted.' });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(port, () => {
  console.log(`Serum preset editor API listening on port ${port}`);
});
