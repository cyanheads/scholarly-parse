/**
 * @fileoverview The timing check every growth test runs: code that reads attacker-controlled
 * input must take time in proportion to it. Each step quadruples the input. Linear work
 * then takes about 4× as long, and up to about 8× on a step whose larger input outgrows a
 * cache the smaller one fits in; quadratic work takes about 16×. A step fails at 11×,
 * about the geometric middle of 8 and 16.
 *
 * Time is the CPU time of the thread doing the work, so waiting for a CPU while the rest of
 * the suite runs never counts. What load still adds (a slower core, a colder cache) only
 * adds time: a size's time is the fastest of several samples, the two sizes of a step are
 * sampled in alternation so a busy spell slows both, and a step that looks quadratic is
 * sampled again after a pause before it fails. Quadratic work grows about 16× however
 * often it is timed; `tests/linear.test.ts` checks that it fails.
 * @module tests/linear
 */
import { expect } from 'vitest';

/** How many times larger each step's input is. */
const STEP = 4;

/** Time growth a step fails at. */
const MAX_GROWTH = 11;

/** Samples of each size in one round, the sizes alternating. */
const SAMPLES = 3;

/** Least CPU time one sample runs for, calling again until it is reached. */
const SAMPLE_MS = 10;

/** Rounds a step is sampled for, a pause apart, while its growth reaches {@link MAX_GROWTH}. */
const ROUNDS = 5;

const PAUSE_MS = 100;

/**
 * Time `run` on `input(n)` for n from `from` to `to` in fourfold steps, and fail when one
 * step's time grows {@link MAX_GROWTH}-fold or more. Keep `to` small enough that the linear
 * path stays fast: a quadratic one fails at the first step where its growth shows, before
 * its time gets long.
 */
export async function expectLinear<T>(
  input: (n: number) => T,
  run: (input: T) => unknown,
  { from, to }: { from: number; to: number },
): Promise<void> {
  for (let n = from; n * STEP <= to; n *= STEP) {
    const smaller = input(n);
    const larger = input(n * STEP);
    // The first calls pay for compiling the code and loading lazy modules.
    await run(smaller);
    await run(larger);
    let before = Number.POSITIVE_INFINITY;
    let after = Number.POSITIVE_INFINITY;
    let growth = Number.POSITIVE_INFINITY;
    for (let round = 0; round < ROUNDS && growth >= MAX_GROWTH; round++) {
      if (round > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      for (let sample = 0; sample < SAMPLES; sample++) {
        before = Math.min(before, await perCall(run, smaller));
        after = Math.min(after, await perCall(run, larger));
      }
      growth = after / before;
    }
    expect(
      growth,
      `${n} → ${n * STEP}: ${before.toFixed(3)} ms → ${after.toFixed(3)} ms per call`,
    ).toBeLessThan(MAX_GROWTH);
  }
}

/** One call's CPU time, averaged over calls made for at least {@link SAMPLE_MS} of it. */
async function perCall<T>(run: (input: T) => unknown, input: T): Promise<number> {
  const started = threadMs();
  let calls = 0;
  let spent = 0;
  do {
    const result = run(input);
    if (result instanceof Promise) await result;
    calls++;
    spent = threadMs() - started;
  } while (spent < SAMPLE_MS);
  return spent / calls;
}

/** CPU time the calling thread has run for, in milliseconds. */
function threadMs(): number {
  const { system, user } = process.threadCpuUsage();
  return (system + user) / 1000;
}
