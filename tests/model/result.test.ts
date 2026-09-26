/**
 * @fileoverview The result contract's backstop: a throw a parser did not anticipate
 * becomes a `malformed` result, and a missing optional peer still throws.
 * @module tests/model/result.test
 */
import { describe, expect, it } from 'vitest';
import { guard, guardAsync, MissingPeerError, parsed } from '../../src/model/result.js';

describe('guard', () => {
  it('returns what the parse returns', () => {
    const result = parsed({
      abstracts: [],
      back: [],
      body: [],
      diagnostics: { quality: 'flat', unhandled: [], warnings: [] },
      floats: [],
      footnotes: [],
      format: 'jats',
      metadata: {},
      references: [],
    });
    expect(guard(() => result)).toBe(result);
  });

  it('turns an unexpected throw into a malformed result', async () => {
    const boom = () => {
      throw new RangeError('Maximum call stack size exceeded');
    };
    expect(guard(boom)).toEqual({
      error: {
        message: 'The document could not be read: Maximum call stack size exceeded',
        reason: 'malformed',
      },
      ok: false,
    });
    expect(await guardAsync(async () => boom())).toMatchObject({
      error: { reason: 'malformed' },
    });
  });

  it('lets a missing peer throw', async () => {
    const missing = () => {
      throw new MissingPeerError('Install "linkedom" to parse HTML: bun add linkedom');
    };
    expect(() => guard(missing)).toThrow(MissingPeerError);
    await expect(guardAsync(async () => missing())).rejects.toThrow('Install "linkedom"');
  });
});
