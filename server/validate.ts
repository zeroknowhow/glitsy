import { applyPatch, getValueByPointer, deepClone } from 'fast-json-patch';
import { z } from 'zod';

const jsonPointerPattern = /^\/(?:[^~\/]|~0|~1)*(?:\/(?:[^~\/]|~0|~1)*)*$/;

const operationSchema = z
  .object({
    op: z.enum(['add', 'remove', 'replace', 'copy', 'move', 'test']),
    path: z.string().regex(jsonPointerPattern, 'Invalid JSON Pointer'),
    from: z.string().optional(),
    value: z.unknown().optional()
  })
  .superRefine((op, ctx) => {
    if (op.op === 'add' || op.op === 'replace' || op.op === 'test') {
      if (!('value' in op)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${op.op} requires a value` });
      }
    }

    if ((op.op === 'copy' || op.op === 'move') && !op.from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${op.op} requires a from pointer` });
    }

    if (op.op === 'move' || op.op === 'copy') {
      if (op.from && !jsonPointerPattern.test(op.from)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid from pointer' });
      }
    }
  });

const patchSchema = z.array(operationSchema);

export type ValidatedPatch = z.infer<typeof patchSchema>;

export function validatePatchStructure(patch: unknown): ValidatedPatch {
  return patchSchema.parse(patch);
}

function pointerParent(path: string): string | null {
  if (path === '') {
    return null;
  }
  const segments = path.split('/').slice(0, -1);
  if (segments.length <= 1) {
    return '/';
  }
  return segments.join('/') || '/';
}

function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function pathExists(document: unknown, pointer: string): boolean {
  try {
    getValueByPointer(document, pointer);
    return true;
  } catch (error) {
    return false;
  }
}

function parentExists(document: unknown, pointer: string): boolean {
  if (pointer === '/' || pointer === '') {
    return true;
  }
  const parent = pointerParent(pointer);
  if (!parent) return true;
  if (parent === '/' && pointer.split('/').length === 2) {
    return true;
  }
  return pathExists(document, parent);
}

export function validatePatchSemantics(document: unknown, patch: ValidatedPatch): void {
  for (const op of patch) {
    if (op.op === 'replace' || op.op === 'remove' || op.op === 'test') {
      if (!pathExists(document, op.path)) {
        throw new Error(`Path ${op.path} does not exist for operation ${op.op}`);
      }
    }

    if (op.op === 'add' && !parentExists(document, op.path)) {
      throw new Error(`Cannot add value at ${op.path} because parent path is missing.`);
    }

    if ((op.op === 'move' || op.op === 'copy') && op.from) {
      if (!pathExists(document, op.from)) {
        throw new Error(`Source path ${op.from} does not exist for operation ${op.op}`);
      }
    }

    if (op.op === 'replace' && op.value !== undefined) {
      try {
        const current = getValueByPointer(document, op.path);
        const currentType = getType(current);
        const nextType = getType(op.value);
        if (current !== null && op.value !== null && currentType !== nextType) {
          throw new Error(`Type mismatch at ${op.path}: expected ${currentType}, received ${nextType}`);
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }
}

export function applyPatchWithValidation<T>(document: T, patch: ValidatedPatch): T {
  const workingDocument = deepClone(document) as T;
  validatePatchSemantics(workingDocument, patch);
  const result = applyPatch(workingDocument as unknown as Record<string, unknown>, patch, true, true);
  return result.newDocument as T;
}
