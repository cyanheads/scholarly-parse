/**
 * @fileoverview The timing check every growth test runs: code that reads attacker-controlled
 * input must take time in proportion to it. Each step quadruples the input, and three
 * bounds hold at every step:
 *
 * - **The step.** Linear work takes about 4× as long per step, and up to about 8× on a step
 *   whose larger input outgrows a cache the smaller one fits in; quadratic work takes about
 *   16×. A step fails at 11×, about the geometric middle of 8 and 16.
 * - **The span so far.** From the smallest input to the current one, the input grows by a
 *   span `S`: linear work grows by about `S`, up to `2S` with the cache effects of the whole
 *   span, and quadratic work by `S²`. The span fails at `√2 · S^1.5`, the geometric middle
 *   of `2S` and `S²` (11.3× for one step). It catches growth short of quadratic at each
 *   step that the step bound lets through when it runs on over several steps.
 * - **The call.** One call takes less than an absolute amount of CPU time at every size, so
 *   a slow path that a costly small input hides from both ratios still fails.
 *
 * Time is the CPU time of the thread doing the work, so waiting for a CPU while the rest of
 * the suite runs never counts. What load still adds (a slower core, a colder cache) only
 * adds time: a size's time is the fastest of several samples, the sizes of a step are
 * sampled in alternation so a busy spell slows them all, and a step that breaks a bound is
 * sampled again after a pause before it fails. Quadratic work grows about 16× a step however
 * often it is timed; `tests/linear.test.ts` checks that it fails.
 * @module tests/linear
 */
import { expect } from 'vitest';

/** How many times larger each step's input is. */
const STEP = 4;

/** Time growth a step fails at. */
const MAX_STEP_GROWTH = 11;

/** Time growth over an input that grew `span`-fold, which the span fails at. */
const maxSpanGrowth = (span: number) => Math.SQRT2 * span ** 1.5;

/**
 * CPU time one call may take at any size, unless a test sets its own: about twice the
 * slowest linear call any growth test makes at its largest input.
 */
const MAX_CALL_MS = 2_500;

/** Samples of each size in one round, the sizes alternating. */
const SAMPLES = 3;

/** Least CPU time one sample runs for, calling again until it is reached. */
const SAMPLE_MS = 10;

/** Rounds a step is sampled for, a pause apart, while it breaks a bound. */
const ROUNDS = 5;

const PAUSE_MS = 100;

/**
 * Time `run` on `input(n)` for n from `from` to `to` in fourfold steps, and fail when a
 * step's time grows {@link MAX_STEP_GROWTH}-fold or more, when the time since `from` grows
 * {@link maxSpanGrowth} or more, or when one call takes `maxMs` of CPU time or more. Keep
 * `to` small enough that the linear path stays fast: a quadratic one fails at the first
 * step where its growth shows, before its time gets long.
 */
export async function expectLinear<T>(
  input: (n: number) => T,
  run: (input: T) => unknown,
  { from, maxMs = MAX_CALL_MS, to }: { from: number; maxMs?: number; to: number },
): Promise<void> {
  const smallest = input(from);
  // The first calls pay for compiling the code and loading lazy modules.
  await run(smallest);
  let base = Number.POSITIVE_INFINITY;
  for (let n = from; n * STEP <= to; n *= STEP) {
    const smaller = n === from ? smallest : input(n);
    const larger = input(n * STEP);
    await run(smaller);
    await run(larger);
    const span = (n * STEP) / from;
    let before = Number.POSITIVE_INFINITY;
    let after = Number.POSITIVE_INFINITY;
    const broken = () =>
      after / before >= MAX_STEP_GROWTH || after / base >= maxSpanGrowth(span) || after >= maxMs;
    for (let round = 0; round < ROUNDS && (round === 0 || broken()); round++) {
      if (round > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      for (let sample = 0; sample < SAMPLES; sample++) {
        before = Math.min(before, await perCall(run, smaller));
        after = Math.min(after, await perCall(run, larger));
        // The first step samples the smallest input; a later step's retry samples it again.
        if (n === from) base = before;
        else if (round > 0) base = Math.min(base, await perCall(run, smallest));
      }
    }
    const step = `${n} → ${n * STEP}: ${before.toFixed(3)} ms → ${after.toFixed(3)} ms per call`;
    expect(after / before, `step ${step}`).toBeLessThan(MAX_STEP_GROWTH);
    expect(
      after / base,
      `span ${from} → ${n * STEP}: ${base.toFixed(3)} ms → ${after.toFixed(3)} ms per call`,
    ).toBeLessThan(maxSpanGrowth(span));
    expect(after, `CPU time at ${step}`).toBeLessThan(maxMs);
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
