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
import type * as crons from "../crons.js";
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
import type * as offers_admin from "../offers/admin.js";
import type * as offers_ads_admin from "../offers/ads/admin.js";
import type * as offers_ads_providers_registry from "../offers/ads/providers/registry.js";
import type * as offers_ads_providers_rtbHouseProvider from "../offers/ads/providers/rtbHouseProvider.js";
import type * as offers_ads_public from "../offers/ads/public.js";
import type * as offers_ads_tracking from "../offers/ads/tracking.js";
import type * as offers_ads_types from "../offers/ads/types.js";
import type * as offers_catalog_lifecycle from "../offers/catalog/lifecycle.js";
import type * as offers_catalog_normalizer from "../offers/catalog/normalizer.js";
import type * as offers_catalog_repository from "../offers/catalog/repository.js";
import type * as offers_matching_eligibility from "../offers/matching/eligibility.js";
import type * as offers_matching_matcher from "../offers/matching/matcher.js";
import type * as offers_matching_recommendations from "../offers/matching/recommendations.js";
import type * as offers_matching_scoring_defaultStrategy from "../offers/matching/scoring/defaultStrategy.js";
import type * as offers_matching_scoring_marginFirstStrategy from "../offers/matching/scoring/marginFirstStrategy.js";
import type * as offers_matching_scoring_registry from "../offers/matching/scoring/registry.js";
import type * as offers_matching_scoring_types from "../offers/matching/scoring/types.js";
import type * as offers_messages_renderer from "../offers/messages/renderer.js";
import type * as offers_messages_templates from "../offers/messages/templates.js";
import type * as offers_providers_awinProvider from "../offers/providers/awinProvider.js";
import type * as offers_providers_feedUtils from "../offers/providers/feedUtils.js";
import type * as offers_providers_ingestionScheduler from "../offers/providers/ingestionScheduler.js";
import type * as offers_providers_manualProvider from "../offers/providers/manualProvider.js";
import type * as offers_providers_providerTypes from "../offers/providers/providerTypes.js";
import type * as offers_providers_registry from "../offers/providers/registry.js";
import type * as offers_providers_tradeTrackerProvider from "../offers/providers/tradeTrackerProvider.js";
import type * as offers_public from "../offers/public.js";
import type * as offers_segments_calculator from "../offers/segments/calculator.js";
import type * as offers_segments_jobs from "../offers/segments/jobs.js";
import type * as offers_segments_rules from "../offers/segments/rules.js";
import type * as offers_segments_scheduler from "../offers/segments/scheduler.js";
import type * as offers_tracking_analytics from "../offers/tracking/analytics.js";
import type * as offers_tracking_clicks from "../offers/tracking/clicks.js";
import type * as offers_tracking_conversions from "../offers/tracking/conversions.js";
import type * as offers_types from "../offers/types.js";
import type * as pendingExpenses from "../pendingExpenses.js";
import type * as productMappings from "../productMappings.js";
import type * as profile from "../profile.js";
import type * as router from "../router.js";
import type * as seed from "../seed.js";
import type * as shopping from "../shopping.js";
import type * as trips from "../trips.js";

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
  crons: typeof crons;
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
  "offers/admin": typeof offers_admin;
  "offers/ads/admin": typeof offers_ads_admin;
  "offers/ads/providers/registry": typeof offers_ads_providers_registry;
  "offers/ads/providers/rtbHouseProvider": typeof offers_ads_providers_rtbHouseProvider;
  "offers/ads/public": typeof offers_ads_public;
  "offers/ads/tracking": typeof offers_ads_tracking;
  "offers/ads/types": typeof offers_ads_types;
  "offers/catalog/lifecycle": typeof offers_catalog_lifecycle;
  "offers/catalog/normalizer": typeof offers_catalog_normalizer;
  "offers/catalog/repository": typeof offers_catalog_repository;
  "offers/matching/eligibility": typeof offers_matching_eligibility;
  "offers/matching/matcher": typeof offers_matching_matcher;
  "offers/matching/recommendations": typeof offers_matching_recommendations;
  "offers/matching/scoring/defaultStrategy": typeof offers_matching_scoring_defaultStrategy;
  "offers/matching/scoring/marginFirstStrategy": typeof offers_matching_scoring_marginFirstStrategy;
  "offers/matching/scoring/registry": typeof offers_matching_scoring_registry;
  "offers/matching/scoring/types": typeof offers_matching_scoring_types;
  "offers/messages/renderer": typeof offers_messages_renderer;
  "offers/messages/templates": typeof offers_messages_templates;
  "offers/providers/awinProvider": typeof offers_providers_awinProvider;
  "offers/providers/feedUtils": typeof offers_providers_feedUtils;
  "offers/providers/ingestionScheduler": typeof offers_providers_ingestionScheduler;
  "offers/providers/manualProvider": typeof offers_providers_manualProvider;
  "offers/providers/providerTypes": typeof offers_providers_providerTypes;
  "offers/providers/registry": typeof offers_providers_registry;
  "offers/providers/tradeTrackerProvider": typeof offers_providers_tradeTrackerProvider;
  "offers/public": typeof offers_public;
  "offers/segments/calculator": typeof offers_segments_calculator;
  "offers/segments/jobs": typeof offers_segments_jobs;
  "offers/segments/rules": typeof offers_segments_rules;
  "offers/segments/scheduler": typeof offers_segments_scheduler;
  "offers/tracking/analytics": typeof offers_tracking_analytics;
  "offers/tracking/clicks": typeof offers_tracking_clicks;
  "offers/tracking/conversions": typeof offers_tracking_conversions;
  "offers/types": typeof offers_types;
  pendingExpenses: typeof pendingExpenses;
  productMappings: typeof productMappings;
  profile: typeof profile;
  router: typeof router;
  seed: typeof seed;
  shopping: typeof shopping;
  trips: typeof trips;
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
