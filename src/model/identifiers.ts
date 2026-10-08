/**
 * @fileoverview PMC IDs, PMIDs, and ORCID iDs as the model holds them. A field the source
 * types as one of these holds it in whatever form its producer wrote: a `PMCID:` or
 * `PMID:` label, a link to PMC, PubMed, or orcid.org, a lowercase `pmc` or check
 * character. Each normalizer reads that form to the canonical one, or to nothing when
 * the value is not an identifier (`pending`, `n/a`, a PubMed search query). JATS, TEI,
 * and HTML identifier fields normalize here, beside `normalizeDoi`.
 * @module src/model/identifiers
 */

/** A PMC article page: NCBI's former `www.ncbi.nlm.nih.gov/pmc/articles/` and current `pmc.ncbi.nlm.nih.gov/articles/`. */
const PMC_URL =
  /^https?:\/\/(?:(?:www\.)?ncbi\.nlm\.nih\.gov\/pmc\/articles\/|pmc\.ncbi\.nlm\.nih\.gov\/articles\/)/i;

/** A PubMed record page: `pubmed.ncbi.nlm.nih.gov/` and the former `www.ncbi.nlm.nih.gov/pubmed/`. */
const PUBMED_URL =
  /^https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov\/|(?:www\.)?ncbi\.nlm\.nih\.gov\/pubmed\/)/i;

/** An ORCID record page, with or without its scheme. */
const ORCID_URL = /^(?:https?:\/\/)?(?:www\.)?orcid\.org\//i;

/**
 * A PMC ID field's value as the model holds it: `PMC` and the article number, whatever
 * the case of the prefix, with or without it, without a `PMCID:` label, the PMC page URL
 * around it, or the version PMC's versioned form adds (`pmc123456`, `123456`,
 * `PMC123456.1`, `https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/` → `PMC123456`).
 * Undefined for anything else (`PMC`, `pending`, `n/a`).
 */
export function normalizePmcid(value: string | undefined): string | undefined {
  const digits = /^(?:PMC)?(\d+)(?:\.\d+)?$/i.exec(stripLink(value, PMC_URL, /^PMCID:?\s*/i))?.[1];
  return digits ? `PMC${digits}` : undefined;
}

/**
 * A PMID field's value as the model holds it: the PubMed number alone, without a `PMID:`
 * label or the PubMed page URL around it (`PMID: 21491125`,
 * `https://pubmed.ncbi.nlm.nih.gov/21491125/` → `21491125`). Undefined for anything else
 * (`n/a`, a number holding letters, a PubMed search query).
 */
export function normalizePmid(value: string | undefined): string | undefined {
  const pmid = stripLink(value, PUBMED_URL, /^PMID:?\s*/i);
  return /^\d+$/.test(pmid) ? pmid : undefined;
}

/**
 * An ORCID field's value as the model holds it: the bare hyphenated iD with its check
 * character an uppercase `X`, without an `ORCID:` label, the orcid.org URL around it, or
 * both (`https://orcid.org/0000-0002-1694-233x` → `0000-0002-1694-233X`). Undefined for
 * anything else (15 characters, no hyphens, another host).
 */
export function normalizeOrcid(value: string | undefined): string | undefined {
  const orcid = stripLink(value, ORCID_URL, /^ORCID:?\s*/i);
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(orcid) ? orcid.toUpperCase() : undefined;
}

/**
 * `value` trimmed and without a `label` prefix that does not start a `link`, then without
 * the `link` prefix and whatever follows the identifier in the link (a trailing `/`, a
 * query, a fragment).
 */
function stripLink(value: string | undefined, link: RegExp, label: RegExp): string {
  const trimmed = (value ?? '').trim();
  const unlabelled = link.test(trimmed) ? trimmed : trimmed.replace(label, '');
  const url = link.exec(unlabelled);
  if (!url) return unlabelled;
  const path = unlabelled.slice(url[0].length);
  return path.slice(0, path.search(/[/?#]|$/));
}
