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
    /<title>\s*Just a moment\.\.\.\s*<\/title>|challenges\.cloudflare\.com|_cf_chl_opt|cf-browser-verification|Enable JavaScript and cookies to continue|Checking if the site connection is secure/i,
    'a Cloudflare challenge page',
  ],
  [/<title>\s*Attention Required! \| Cloudflare/i, 'a Cloudflare block page'],
  [/captcha-delivery\.com/i, 'a DataDome challenge page'],
  [/_Incapsula_Resource|Incapsula incident ID/i, 'an Imperva challenge page'],
  [/distil_r_captcha/i, 'a Distil Networks challenge page'],
  [/id=["']px-captcha["']/i, 'a HUMAN (PerimeterX) challenge page'],
  [/AwsWafIntegration|awswaf\.com/i, 'an AWS WAF challenge page'],
  [/<title>\s*Radware Bot Manager|perfdrive\.com\/aperture/i, 'a Radware challenge page'],
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

/**
 * Every `<meta>` tag's text, each read to its `>` or the next `<`: a tag pattern that
 * reads to the next `>` rereads the rest of the page from each of a run of unclosed tags.
 */
const META_TAG = /<meta\b[^<>]*/gi;

/** A refresh tag's `content`: its delay, then the URL it redirects to. */
const REFRESH_TARGET = /content=["']?\s*\d+\s*;\s*url=\s*['"]?([^'">\s]+)/i;

/**
 * Describes the interstitial `html` is, or returns undefined for a real page. A page
 * carrying scholarly citation metadata or substantial text is never an interstitial,
 * so a bot-protection script loaded by a real article does not trip this.
 */
export function interstitialReason(html: string): string | undefined {
  if (html.length > MAX_INTERSTITIAL_CHARS) return;
  const metaTags = html.match(META_TAG) ?? [];
  if (metaTags.some((tag) => /name=["']citation_title["']/i.test(tag))) return;
  if (visibleText(html).length > MAX_INTERSTITIAL_TEXT) return;
  const match = SIGNATURES.find(([pattern]) => pattern.test(html));
  if (match) return `The page is ${match[1]}, not the document`;
  const refresh = metaTags.map(redirectTarget).find(Boolean);
  if (refresh)
    return `The page is a redirect stub to ${refresh.replace(/&amp;/g, '&')}, not the document`;
  return;
}

/**
 * Where a `<meta http-equiv="refresh">` tag redirects to, its attributes in either order.
 * Each attribute is searched for once within the tag, never from every place in it.
 */
function redirectTarget(tag: string): string | undefined {
  return /http-equiv=["']?refresh/i.test(tag) ? REFRESH_TARGET.exec(tag)?.[1] : undefined;
}

/** Text a reader would see: scripts, styles, and tags removed, whitespace collapsed. */
function visibleText(html: string): string {
  return withoutHiddenElements(html)
    .replace(/<[^<>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Elements whose content a reader never sees. */
const HIDDEN_ELEMENT = /<(script|style|noscript|template)\b/gi;

/**
 * `html` with each script, style, noscript, and template element, from its opening tag to
 * the first closing tag of its name, replaced by a space; an opening tag with no closing
 * tag after it stays. Each closing tag is found with one forward search, and a name with
 * no closing tag left is not searched for again, so a run of unclosed openers is read once.
 */
function withoutHiddenElements(html: string): string {
  const unclosed = new Set<string>();
  let out = '';
  let copied = 0;
  for (const open of html.matchAll(HIDDEN_ELEMENT)) {
    const name = open[1]?.toLowerCase() ?? '';
    if (open.index < copied || unclosed.has(name)) continue;
    const close = new RegExp(`</${name}\\s*>`, 'gi');
    close.lastIndex = open.index + open[0].length;
    const end = close.exec(html);
    if (!end) {
      unclosed.add(name);
      continue;
    }
    out += `${html.slice(copied, open.index)} `;
    copied = end.index + end[0].length;
  }
  return out + html.slice(copied);
}
