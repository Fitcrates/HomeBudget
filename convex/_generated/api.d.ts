/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as budgets from "../budgets.js";
import type * as categories from "../categories.js";
import type * as chat from "../chat.js";
import type * as chatNode from "../chatNode.js";
import type * as emailIngest from "../emailIngest.js";
import type * as emailTokens from "../emailTokens.js";
import type * as expenses from "../expenses.js";
import type * as goals from "../goals.js";
import type * as households from "../households.js";
import type * as http from "../http.js";
import type * as income from "../income.js";
import type * as insights from "../insights.js";
import type * as insightsNode from "../insightsNode.js";
import type * as lib_pendingEmailExpenses from "../lib/pendingEmailExpenses.js";
import type * as migrations from "../migrations.js";
import type * as ocr from "../ocr.js";
import type * as ocrLogs from "../ocrLogs.js";
import type * as ocr_categories_clothing from "../ocr/categories/clothing.js";
import type * as ocr_categories_commerce from "../ocr/categories/commerce.js";
import type * as ocr_categories_constants from "../ocr/categories/constants.js";
import type * as ocr_categories_family from "../ocr/categories/family.js";
import type * as ocr_categories_food from "../ocr/categories/food.js";
import type * as ocr_categories_health from "../ocr/categories/health.js";
import type * as ocr_categories_home from "../ocr/categories/home.js";
import type * as ocr_categories_household from "../ocr/categories/household.js";
import type * as ocr_categories_index from "../ocr/categories/index.js";
import type * as ocr_categories_issuers from "../ocr/categories/issuers.js";
import type * as ocr_categories_lifestyle from "../ocr/categories/lifestyle.js";
import type * as ocr_categories_transport from "../ocr/categories/transport.js";
import type * as ocr_groq from "../ocr/groq.js";
import type * as ocr_normalization from "../ocr/normalization.js";
import type * as ocr_parser from "../ocr/parser.js";
import type * as ocr_prompt from "../ocr/prompt.js";
import type * as ocr_types from "../ocr/types.js";
import type * as ocr_utils from "../ocr/utils.js";
import type * as pendingExpenses from "../pendingExpenses.js";
import type * as productMappings from "../productMappings.js";
import type * as profile from "../profile.js";
import type * as router from "../router.js";
import type * as seed from "../seed.js";
import type * as shopping from "../shopping.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  budgets: typeof budgets;
  categories: typeof categories;
  chat: typeof chat;
  chatNode: typeof chatNode;
  emailIngest: typeof emailIngest;
  emailTokens: typeof emailTokens;
  expenses: typeof expenses;
  goals: typeof goals;
  households: typeof households;
  http: typeof http;
  income: typeof income;
  insights: typeof insights;
  insightsNode: typeof insightsNode;
  "lib/pendingEmailExpenses": typeof lib_pendingEmailExpenses;
  migrations: typeof migrations;
  ocr: typeof ocr;
  ocrLogs: typeof ocrLogs;
  "ocr/categories/clothing": typeof ocr_categories_clothing;
  "ocr/categories/commerce": typeof ocr_categories_commerce;
  "ocr/categories/constants": typeof ocr_categories_constants;
  "ocr/categories/family": typeof ocr_categories_family;
  "ocr/categories/food": typeof ocr_categories_food;
  "ocr/categories/health": typeof ocr_categories_health;
  "ocr/categories/home": typeof ocr_categories_home;
  "ocr/categories/household": typeof ocr_categories_household;
  "ocr/categories/index": typeof ocr_categories_index;
  "ocr/categories/issuers": typeof ocr_categories_issuers;
  "ocr/categories/lifestyle": typeof ocr_categories_lifestyle;
  "ocr/categories/transport": typeof ocr_categories_transport;
  "ocr/groq": typeof ocr_groq;
  "ocr/normalization": typeof ocr_normalization;
  "ocr/parser": typeof ocr_parser;
  "ocr/prompt": typeof ocr_prompt;
  "ocr/types": typeof ocr_types;
  "ocr/utils": typeof ocr_utils;
  pendingExpenses: typeof pendingExpenses;
  productMappings: typeof productMappings;
  profile: typeof profile;
  router: typeof router;
  seed: typeof seed;
  shopping: typeof shopping;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
