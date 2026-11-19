import test from "node:test";
import assert from "node:assert/strict";
import { affiliateStatus, readAttribute, stripAffiliateLabels } from "../scripts/affiliate-links.mjs";
import { cleanArticleContent, hasAmazonAffiliateLinks } from "../scripts/build.js";

const href = "https://www.amazon.fr/dp/B081VJ79QZ?tag=zenretraite11-21";
const tag = "zenretraite11-21";
const expiresFor = asin => asin === "B081VJ79QZ" ? "2027-01-02" : undefined;

test("read actual href, not similarly named attributes or text inside values", () => {
  assert.equal(readAttribute('<a data-href="' + href + '" href = "https://example.org/">', "href"), "https://example.org/");
  assert.equal(readAttribute('<a title=\'href="' + href + '"\' HREF = "https://example.org/">', "href"), "https://example.org/");
  assert.equal(readAttribute('<a data-href="' + href + '">', "href"), null);
  assert.equal(readAttribute('<a href=https://example.org/>', "href"), "https://example.org/");
});

test("classification handles exact host, tag, catalogue and inclusive expiry", () => {
  for (const valid of [href, href + "&amp;language=fr_FR"]) {
    assert.equal(affiliateStatus(valid, tag, expiresFor, "2027-01-02").status, "approved");
  }
  assert.equal(affiliateStatus(href, tag, expiresFor, "2027-01-03").status, "expired");
  for (const bad of [href + "&tag=other-21", href + "&tag=" + tag, href.replace(tag, ""), href.replace("https:", "http:"), href.replace("/dp/", "/s/dp/"), href.replace("B081VJ79QZ", "B000000000")]) {
    assert.equal(affiliateStatus(bad, tag, expiresFor, "2026-11-19").status, "blocked");
  }
  assert.equal(affiliateStatus(href.replace("amazon.fr", "amazon.fr.example.org"), tag, expiresFor).status, "external");
});

test("strip both historical and normalized affiliate labels when neutralizing links", () => {
  const inner = '<strong>Produit</strong><span class="affiliate-label"> (lien affilié)</span><span class="affiliate-label"> (lien rémunéré)</span>';
  assert.equal(stripAffiliateLabels(inner), "<strong>Produit</strong>");
  const bad = '<a href="' + href + '&amp;tag=wrong-21" data-affiliate="amazon">' + inner + '</a>';
  assert.equal(cleanArticleContent(bad), "<strong>Produit</strong>");
  assert.equal(hasAmazonAffiliateLinks(bad), false);
});

test("similar data-href does not change or classify non-Amazon links", () => {
  const external = '<a data-href="' + href + '" href="https://example.org/">Guide</a>';
  assert.equal(cleanArticleContent(external), external);
  assert.equal(hasAmazonAffiliateLinks(external), false);
});

test("a valid affiliate link gets exactly one normalized tracking marker and label", () => {
  if (affiliateStatus(href, tag, expiresFor).status !== "approved") return;
  const input = '<a href="' + href + '" data-affiliate="wrong" data-affiliate="amazon">Produit<span class="affiliate-label"> (lien affilié)</span> (lien rémunéré)</a>';
  const output = cleanArticleContent(input);
  assert.equal((output.match(/data-affiliate="amazon"/g) || []).length, 1);
  assert.equal((output.match(/\(lien rémunéré\)/g) || []).length, 1);
  assert.doesNotMatch(output, /lien affilié|data-affiliate="wrong"/);
  assert.equal(cleanArticleContent(output), output);
});
