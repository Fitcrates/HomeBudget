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
import type * as emailIngest from "../emailIngest.js";
import type * as emailTokens from "../emailTokens.js";
import type * as expenses from "../expenses.js";
import type * as households from "../households.js";
import type * as http from "../http.js";
import type * as income from "../income.js";
import type * as insights from "../insights.js";
import type * as insightsNode from "../insightsNode.js";
import type * as migrations from "../migrations.js";
import type * as ocr from "../ocr.js";
import type * as pendingExpenses from "../pendingExpenses.js";
import type * as profile from "../profile.js";
import type * as router from "../router.js";
import type * as seed from "../seed.js";

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
  emailIngest: typeof emailIngest;
  emailTokens: typeof emailTokens;
  expenses: typeof expenses;
  households: typeof households;
  http: typeof http;
  income: typeof income;
  insights: typeof insights;
  insightsNode: typeof insightsNode;
  migrations: typeof migrations;
  ocr: typeof ocr;
  pendingExpenses: typeof pendingExpenses;
  profile: typeof profile;
  router: typeof router;
  seed: typeof seed;
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
