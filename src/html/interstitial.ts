/**
 * @fileoverview Recognizes a page that stands in for the document: a bot-protection
 * challenge, an access-denied page from a CDN, or a redirect stub. Fetchers commonly
 * receive one with a 200 or 403 status, and parsing it as an article would produce a
 * document about "Just a moment...". Only the raw markup is inspected, so no DOM is built.
 * @module src/html/interstitial
 */

/** Interstitials are small; anything larger is a real page with more than a challenge on it. */
const MAX_INTERSTITIAL_CHARS = 512 * 1024;

/** Visible text past which a page carries content of its own, whatever scripts it loads. */
const MAX_INTERSTITIAL_TEXT = 3000;

/** Signatures of challenge and block pages, each with the name it is reported as. */
const SIGNATURES: [RegExp, string][] = [
  [
    /<title>\s*Just a moment\.\.\.\s*<\/title>|challenges\.cloudflare\.com|_cf_chl_opt/i,
    'a Cloudflare challenge page',
  ],
  [/<title>\s*Attention Required! \| Cloudflare/i, 'a Cloudflare block page'],
  [/captcha-delivery\.com/i, 'a DataDome challenge page'],
  [/_Incapsula_Resource|Incapsula incident ID/i, 'an Imperva challenge page'],
  [/id=["']px-captcha["']/i, 'a HUMAN (PerimeterX) challenge page'],
  [/AwsWafIntegration|awswaf\.com/i, 'an AWS WAF challenge page'],
  [/errors\.edgesuite\.net|<title>\s*Access Denied\s*<\/title>/i, 'an access-denied page'],
  [/<title>\s*Client Challenge\s*<\/title>/i, 'a bot-protection challenge page'],
  [/Vercel Security Checkpoint/i, 'a Vercel security checkpoint'],
  [/Sucuri WebSite Firewall/i, 'a Sucuri firewall page'],
  [
    /<title>\s*(?:Making sure you(?:'|&#39;|’)re not a bot|Checking your browser)/i,
    'a bot-check page',
  ],
  [
    /\b(?:verify (?:that )?you are (?:a )?human|are you a robot|unusual traffic from your (?:computer|network))\b/i,
    'a bot-check page',
  ],
];

const META_REFRESH =
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=\s*['"]?([^'">\s]+)/i;

/**
 * Describes the interstitial `html` is, or returns undefined for a real page. A page
 * carrying scholarly citation metadata or substantial text is never an interstitial,
 * so a bot-protection script loaded by a real article does not trip this.
 */
export function interstitialReason(html: string): string | undefined {
  if (html.length > MAX_INTERSTITIAL_CHARS) return;
  if (/<meta[^>]+name=["']citation_title["']/i.test(html)) return;
  if (visibleText(html).length > MAX_INTERSTITIAL_TEXT) return;
  const match = SIGNATURES.find(([pattern]) => pattern.test(html));
  if (match) return `The page is ${match[1]}, not the document`;
  const refresh = META_REFRESH.exec(html)?.[1];
  if (refresh)
    return `The page is a redirect stub to ${refresh.replace(/&amp;/g, '&')}, not the document`;
  return;
}

/** Text a reader would see: scripts, styles, and tags removed, whitespace collapsed. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
