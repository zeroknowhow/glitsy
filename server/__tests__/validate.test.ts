import { describe, expect, it } from 'vitest';
import { validatePatchStructure, validatePatchSemantics, applyPatchWithValidation } from '../validate.js';

const sampleDoc = {
  metadata: { name: 'Init', author: 'Test' },
  data: {
    osc1: { level: 0.5, wave: 'saw' },
    filter: { cutoff: 200 }
  }
};

describe('validatePatchStructure', () => {
  it('accepts a valid replace operation', () => {
    const patch = [
      { op: 'replace', path: '/data/filter/cutoff', value: 800 }
    ];
    const validated = validatePatchStructure(patch);
    expect(validated).toHaveLength(1);
  });

  it('rejects invalid pointer syntax', () => {
    const patch = [
      { op: 'replace', path: 'data/filter/cutoff', value: 800 }
    ];
    expect(() => validatePatchStructure(patch)).toThrowError();
  });
});

describe('validatePatchSemantics', () => {
  it('throws when replacing a non-existent path', () => {
    const patch = validatePatchStructure([
      { op: 'replace', path: '/data/filter/resonance', value: 0.3 }
    ]);
    expect(() => validatePatchSemantics(sampleDoc, patch)).toThrowError(/does not exist/);
  });

  it('throws on type mismatch', () => {
    const patch = validatePatchStructure([
      { op: 'replace', path: '/data/filter/cutoff', value: 'fast' }
    ]);
    expect(() => validatePatchSemantics(sampleDoc, patch)).toThrowError(/Type mismatch/);
  });

  it('allows safe replacements', () => {
    const patch = validatePatchStructure([
      { op: 'replace', path: '/data/filter/cutoff', value: 512 }
    ]);
    expect(() => validatePatchSemantics(sampleDoc, patch)).not.toThrow();
  });
});

describe('applyPatchWithValidation', () => {
  it('applies a valid patch and returns a new document', () => {
    const patch = validatePatchStructure([
      { op: 'replace', path: '/data/osc1/level', value: 0.8 }
    ]);
    const patched = applyPatchWithValidation(sampleDoc, patch);
    expect(patched.data.osc1.level).toBe(0.8);
    expect(sampleDoc.data.osc1.level).toBe(0.5);
  });
});
