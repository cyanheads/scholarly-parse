/**
 * @fileoverview `expectLinear` on work whose growth is known: linear work passes and
 * quadratic work fails, so a growth test that passes says something.
 * @module tests/linear.test
 */
import { describe, expect, it } from 'vitest';
import { expectLinear } from './linear.js';

/** Reads each character once. */
function linear(text: string): number {
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
  return sum;
}

/** Compares every pair of characters. */
function quadratic(text: string): number {
  let pairs = 0;
  for (let i = 0; i < text.length; i++) {
    for (let j = i + 1; j < text.length; j++) if (text.charAt(i) === text.charAt(j)) pairs++;
  }
  return pairs;
}

describe('expectLinear', () => {
  it('passes work that grows in proportion to its input', async () => {
    await expectLinear((n) => 'ab'.repeat(n), linear, { from: 2_000, to: 128_000 });
  });

  it('fails work that grows with the square of its input', async () => {
    await expect(
      expectLinear((n) => 'ab'.repeat(n), quadratic, { from: 250, to: 4_000 }),
    ).rejects.toThrow(/ms per call/);
  });
});
