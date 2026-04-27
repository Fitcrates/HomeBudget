import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const issuers = read("convex/ocr/categories/issuers.ts");
assert.match(issuers, /\\b\(.*action.*\)\\b\|mebl/s, "Home issuer must keep Action inside a word-boundary guarded group.");
assert.doesNotMatch(issuers, /visa\|mastercard|mastercard\|visa/i, "Payment card words must not mark a receipt as finance.");

const categoriesIndex = read("convex/ocr/categories/index.ts");
const foodIndex = categoriesIndex.indexOf("() => matchFood(");
const commerceIndex = categoriesIndex.indexOf("() => matchCommerce(");
const homeIndex = categoriesIndex.indexOf("() => matchHome(");
assert.ok(foodIndex !== -1 && commerceIndex !== -1 && homeIndex !== -1, "Expected category matchers were not found.");
assert.ok(foodIndex < commerceIndex, "Food matcher must run before commerce/finance matcher.");
assert.ok(foodIndex < homeIndex, "Food matcher must run before home matcher.");

const commerce = read("convex/ocr/categories/commerce.ts");
assert.match(commerce, /looksLikeFinanceLine/, "Finance matcher must require finance-like item text.");
assert.doesNotMatch(commerce, /isBankOrInsuranceIssuer\s*\|\|/, "Finance matcher must not classify by issuer context alone.");

console.log("OCR regression checks passed.");
