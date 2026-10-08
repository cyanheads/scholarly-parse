/**
 * @fileoverview Seeded generators for the property tests over the inline paths: a
 * deterministic random source, and source text over an alphabet that spells every
 * construct the escaping guards against (emphasis, code, math, links, autolinks, HTML,
 * character references, bare URLs). A failing case names its seed, so it reproduces.
 * @module tests/property
 */

/** The seeds every property test runs, each for its own fixed number of cases. */
export const SEEDS = [1, 2, 3, 4] as const;

/** A deterministic source of random choices. */
export interface Random {
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** A whole number from 0 up to, not including, `n`. */
  int(n: number): number;
  /** One of `items`. */
  pick<T>(items: readonly T[]): T;
}

/** A {@link Random} from `seed`, by xorshift32: the same seed gives the same choices everywhere. */
export function seeded(seed: number): Random {
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    chance: (p) => next() < p,
    int,
    pick: <T>(items: readonly T[]) => items[int(items.length)] as T,
  };
}

/**
 * The pieces source text is built from: each ASCII character Markdown gives a meaning,
 * space, letters, digits, an underscore run (one GFM can read as emphasis when it is not
 * between letters), and the starts of a bare URL and a character reference.
 */
export const ALPHABET: readonly string[] = [
  '<',
  '>',
  '&',
  '_',
  '__',
  '*',
  '~',
  '[',
  ']',
  '(',
  ')',
  '!',
  '\\',
  '$',
  '`',
  ';',
  '.',
  '/',
  ' ',
  'a',
  'b',
  'x',
  '1',
  '2',
  'https://',
  'www.',
  '&amp;',
];

/** Source text of one to `atoms` pieces of the {@link ALPHABET}. */
export function sourceText(random: Random, atoms: number): string {
  let text = '';
  for (let n = 1 + random.int(atoms); n > 0; n--) text += random.pick(ALPHABET);
  return text;
}

/** Each case `check` reports a problem for, as `[input, problems]`, up to `limit` of them. */
export function failures<T>(
  inputs: Iterable<T>,
  check: (input: T) => readonly string[],
  limit = 5,
): [T, readonly string[]][] {
  const failed: [T, readonly string[]][] = [];
  for (const input of inputs) {
    const problems = check(input);
    if (problems.length > 0) failed.push([input, problems]);
    if (failed.length === limit) break;
  }
  return failed;
}

/** `count` values from `generate`, each from the same {@link Random}. */
export function* cases<T>(
  random: Random,
  count: number,
  generate: (random: Random) => T,
): Generator<T> {
  for (let n = 0; n < count; n++) yield generate(random);
}
