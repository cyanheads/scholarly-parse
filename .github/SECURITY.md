# Security Policy

## Supported Versions

Security fixes land on the latest release of `scholarly-parse`. Older versions are
not patched — upgrade to the current release.

## Reporting a Vulnerability

Please do not open a public issue for security reports. Instead:

- Report privately via GitHub: **Security** tab → **Report a vulnerability**, or
- Email **security@caseyjhand.com**

Include a minimal reproduction where possible — for a parser, the smallest input
document that triggers it. You'll receive an acknowledgment within a few days, and
credit in the release notes if the report leads to a fix (unless you prefer
otherwise).

## Scope

`scholarly-parse` reads untrusted documents. In scope: anything a crafted input can
do beyond producing a wrong parse — unbounded memory or CPU (entity expansion,
deep nesting, pathological regex input), a crash that escapes the `ParseResult`
contract, or content that survives into rendered Markdown as live HTML or script.
