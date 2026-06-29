import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateDescription,
  validateQuorum,
  validateDuration,
  validateVote,
  validatePrintableString,
  MAX_TITLE_LEN,
  MAX_DESC_LEN,
  DEFAULT_MIN_DURATION,
  DEFAULT_MAX_DURATION,
} from '../utils/validation';

describe('validatePrintableString', () => {
  it('accepts normal ASCII text', () => {
    expect(validatePrintableString('Hello World 123!')).toBe(true);
  });

  it('rejects null byte', () => {
    expect(validatePrintableString('hello\x00world')).toBe(false);
  });

  it('rejects tab character', () => {
    expect(validatePrintableString('hello\tworld')).toBe(false);
  });

  it('rejects newline', () => {
    expect(validatePrintableString('hello\nworld')).toBe(false);
  });

  it('rejects DEL character (0x7F)', () => {
    expect(validatePrintableString('hello\x7Fworld')).toBe(false);
  });

  it('rejects carriage return', () => {
    expect(validatePrintableString('line\r\nbreak')).toBe(false);
  });

  it('accepts space (0x20) as the lowest printable char', () => {
    expect(validatePrintableString(' ')).toBe(true);
  });

  it('accepts tilde (0x7E) as the highest printable ASCII char', () => {
    expect(validatePrintableString('~')).toBe(true);
  });

  it('accepts empty string', () => {
    expect(validatePrintableString('')).toBe(true);
  });
});

describe('validateTitle', () => {
  it('rejects empty string', () => {
    const result = validateTitle('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects whitespace-only string', () => {
    const result = validateTitle('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects string exceeding MAX_TITLE_LEN', () => {
    const result = validateTitle('x'.repeat(MAX_TITLE_LEN + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/128/);
  });

  it('accepts string at exactly MAX_TITLE_LEN', () => {
    const result = validateTitle('x'.repeat(MAX_TITLE_LEN));
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects title with control characters', () => {
    const result = validateTitle('Proposal\x00Title');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid characters/i);
  });

  it('rejects title with tab', () => {
    const result = validateTitle('Proposal\tTitle');
    expect(result.valid).toBe(false);
  });

  it('accepts a normal title', () => {
    const result = validateTitle('Fund community grant');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('accepts title with special printable characters', () => {
    const result = validateTitle('Fund @community #grant (v2)!');
    expect(result.valid).toBe(true);
  });

  it('rejects undefined coerced to empty via falsy check', () => {
    const result = validateTitle(undefined as unknown as string);
    expect(result.valid).toBe(false);
  });

  it('rejects null coerced via falsy check', () => {
    const result = validateTitle(null as unknown as string);
    expect(result.valid).toBe(false);
  });
});

describe('validateDescription', () => {
  it('rejects empty string', () => {
    const result = validateDescription('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects whitespace-only string', () => {
    const result = validateDescription('    ');
    expect(result.valid).toBe(false);
  });

  it('rejects string exceeding MAX_DESC_LEN', () => {
    const result = validateDescription('d'.repeat(MAX_DESC_LEN + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/1024/);
  });

  it('accepts string at exactly MAX_DESC_LEN', () => {
    const result = validateDescription('d'.repeat(MAX_DESC_LEN));
    expect(result.valid).toBe(true);
  });

  it('rejects description with null byte', () => {
    const result = validateDescription('Some\x00text');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid characters/i);
  });

  it('rejects description with escape sequences', () => {
    const result = validateDescription('line1\x1B[31mred');
    expect(result.valid).toBe(false);
  });

  it('accepts normal description', () => {
    const result = validateDescription('Allocate 10,000 tokens to the community fund.');
    expect(result.valid).toBe(true);
  });

  it('rejects undefined', () => {
    const result = validateDescription(undefined as unknown as string);
    expect(result.valid).toBe(false);
  });
});

describe('validateQuorum', () => {
  it('rejects empty string', () => {
    const result = validateQuorum('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects whitespace-only', () => {
    const result = validateQuorum('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects zero', () => {
    const result = validateQuorum('0');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it('rejects negative number', () => {
    const result = validateQuorum('-100');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it('rejects non-numeric string', () => {
    const result = validateQuorum('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it('rejects NaN', () => {
    const result = validateQuorum('NaN');
    expect(result.valid).toBe(false);
  });

  it('does not reject Infinity (Number coercion treats it as > 0)', () => {
    const result = validateQuorum('Infinity');
    expect(result.valid).toBe(true);
  });

  it('rejects Infinity when total supply bounds it', () => {
    const result = validateQuorum('Infinity', 10000);
    expect(result.valid).toBe(false);
  });

  it('accepts valid positive number', () => {
    const result = validateQuorum('5000');
    expect(result.valid).toBe(true);
  });

  it('accepts fractional number', () => {
    const result = validateQuorum('100.5');
    expect(result.valid).toBe(true);
  });

  it('rejects quorum exceeding total supply', () => {
    const result = validateQuorum('10001', 10000);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceed/i);
  });

  it('accepts quorum equal to total supply', () => {
    const result = validateQuorum('10000', 10000);
    expect(result.valid).toBe(true);
  });

  it('accepts quorum below total supply', () => {
    const result = validateQuorum('5000', 10000);
    expect(result.valid).toBe(true);
  });

  it('ignores total supply check when not provided', () => {
    const result = validateQuorum('999999999');
    expect(result.valid).toBe(true);
  });

  it('rejects undefined', () => {
    const result = validateQuorum(undefined as unknown as string);
    expect(result.valid).toBe(false);
  });

  it('rejects empty-looking numbers like "0.0"', () => {
    const result = validateQuorum('0.0');
    expect(result.valid).toBe(false);
  });

  it('rejects scientific notation that evaluates to zero', () => {
    const result = validateQuorum('0e10');
    expect(result.valid).toBe(false);
  });
});

describe('validateDuration', () => {
  it('rejects empty string', () => {
    const result = validateDuration('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects whitespace-only', () => {
    const result = validateDuration('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects zero', () => {
    const result = validateDuration('0');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it('rejects negative duration', () => {
    const result = validateDuration('-3600');
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric string', () => {
    const result = validateDuration('one-week');
    expect(result.valid).toBe(false);
  });

  it('rejects duration below default minimum', () => {
    const result = validateDuration('60');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(String(DEFAULT_MIN_DURATION));
  });

  it('rejects duration above default maximum', () => {
    const result = validateDuration(String(DEFAULT_MAX_DURATION + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(String(DEFAULT_MAX_DURATION));
  });

  it('accepts duration at exactly default minimum', () => {
    const result = validateDuration(String(DEFAULT_MIN_DURATION));
    expect(result.valid).toBe(true);
  });

  it('accepts duration at exactly default maximum', () => {
    const result = validateDuration(String(DEFAULT_MAX_DURATION));
    expect(result.valid).toBe(true);
  });

  it('accepts duration in the valid range', () => {
    const result = validateDuration('86400');
    expect(result.valid).toBe(true);
  });

  it('uses custom min/max when provided', () => {
    const result = validateDuration('30', 10, 100);
    expect(result.valid).toBe(true);
  });

  it('rejects below custom minimum', () => {
    const result = validateDuration('5', 10, 100);
    expect(result.valid).toBe(false);
  });

  it('rejects above custom maximum', () => {
    const result = validateDuration('200', 10, 100);
    expect(result.valid).toBe(false);
  });

  it('includes human-readable format in error', () => {
    const result = validateDuration('60');
    expect(result.error).toMatch(/hour|day|minute/i);
  });

  it('rejects NaN', () => {
    const result = validateDuration('NaN');
    expect(result.valid).toBe(false);
  });

  it('rejects Infinity', () => {
    const result = validateDuration('Infinity');
    expect(result.valid).toBe(false);
  });

  it('rejects undefined', () => {
    const result = validateDuration(undefined as unknown as string);
    expect(result.valid).toBe(false);
  });
});

describe('validateVote', () => {
  it('rejects null', () => {
    const result = validateVote(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/select/i);
  });

  it('rejects empty string', () => {
    const result = validateVote('');
    expect(result.valid).toBe(false);
  });

  it('rejects undefined coerced to null', () => {
    const result = validateVote(undefined as unknown as string);
    expect(result.valid).toBe(false);
  });

  it('accepts "For"', () => {
    const result = validateVote('For');
    expect(result.valid).toBe(true);
  });

  it('accepts "Against"', () => {
    const result = validateVote('Against');
    expect(result.valid).toBe(true);
  });

  it('accepts "Abstain"', () => {
    const result = validateVote('Abstain');
    expect(result.valid).toBe(true);
  });

  it('rejects lowercase "for"', () => {
    const result = validateVote('for');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('rejects uppercase "FOR"', () => {
    const result = validateVote('FOR');
    expect(result.valid).toBe(false);
  });

  it('rejects mixed case "against"', () => {
    const result = validateVote('against');
    expect(result.valid).toBe(false);
  });

  it('rejects arbitrary string', () => {
    const result = validateVote('Maybe');
    expect(result.valid).toBe(false);
  });

  it('rejects numeric string', () => {
    const result = validateVote('1');
    expect(result.valid).toBe(false);
  });

  it('rejects vote with trailing space', () => {
    const result = validateVote('For ');
    expect(result.valid).toBe(false);
  });

  it('rejects vote with leading space', () => {
    const result = validateVote(' Against');
    expect(result.valid).toBe(false);
  });
});
