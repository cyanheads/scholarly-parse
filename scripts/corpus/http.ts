/**
 * @fileoverview HTTP for the corpus scripts: one User-Agent naming the project (with
 * `CORPUS_CONTACT_EMAIL` from `.env` when set), and requests paced per upstream.
 * @module scripts/corpus/http
 */
import process from 'node:process';

/** The contact address from `.env`, sent in the User-Agent and polite-pool parameters. */
export const CONTACT = process.env.CORPUS_CONTACT_EMAIL?.trim() || undefined;

const USER_AGENT = `scholarly-parse corpus (https://github.com/cyanheads/scholarly-parse)${CONTACT ? ` mailto:${CONTACT}` : ''}`;

/** Minimum spacing between requests to one upstream, in milliseconds. */
const PACE_MS = {
  arxiv: 3000,
  crossref: 250,
  epmc: 250,
  grobid: 0,
  ncbi: 350,
  openalex: 100,
  publisher: 1000,
};
export type Upstream = keyof typeof PACE_MS;

/**
 * The first request to an upstream also waits a full interval, so back-to-back runs of
 * a script keep the pacing without shared state.
 */
const lastRequest = new Map<Upstream, number>();
const scriptStart = Date.now();

async function paced(upstream: Upstream): Promise<void> {
  const last = lastRequest.get(upstream) ?? scriptStart;
  const wait = last + PACE_MS[upstream] - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastRequest.set(upstream, Date.now());
}

export interface HttpResult {
  bytes: Uint8Array;
  contentType: string;
  status: number;
  url: string;
}

/** GET `url` once its upstream's interval has passed. A network error or timeout throws. */
export async function request(
  url: string,
  upstream: Upstream,
  accept: string,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  await paced(upstream);
  const response = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': USER_AGENT, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  });
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
    status: response.status,
    url: response.url || url,
  };
}

export const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
