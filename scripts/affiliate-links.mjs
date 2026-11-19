// Shared by the static build and the offline catalogue audit.
export function readAttribute(tag, name) {
  const attributes = tag.replace(/^<\s*[\w:-]+/, "").replace(/>$/, "");
  const tokens = attributes.matchAll(/([^\s=<>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g);
  for (const token of tokens) {
    if (token[1].toLowerCase() === name.toLowerCase()) return token[2] ?? token[3] ?? token[4] ?? "";
  }
  return null;
}

export function affiliateStatus(href, tag, expiresFor, date = new Date().toISOString().slice(0, 10)) {
  if (typeof href !== "string") return { status: "external" };
  let url;
  try { url = new URL(href.replace(/&amp;/gi, "&")); } catch { return { status: "external" }; }
  if (!["amazon.fr", "www.amazon.fr"].includes(url.hostname.toLowerCase())) return { status: "external" };
  const asin = url.pathname.match(/^\/dp\/([A-Z0-9]{10})\/?$/i)?.[1]?.toUpperCase();
  const tags = url.searchParams.getAll("tag");
  const expires = asin && expiresFor(asin);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !asin || !expires || tags.length !== 1 || tags[0] !== tag) return { status: "blocked", asin };
  if (expires < date) return { status: "expired", asin };
  return { status: "approved", asin };
}

export function stripAffiliateLabels(body) {
  return body
    .replace(/<span\b[^>]*\sclass\s*=\s*(["'])[^"']*\baffiliate-label\b[^"']*\1[^>]*>\s*\(lien\s+(?:affilié|rémunéré)\)\s*<\/span>/gi, "")
    .replace(/\s*\(lien\s+(?:affilié|rémunéré)\)(?=\s*(?:<\/a>|$))/gi, "");
}
