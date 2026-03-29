import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  households: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    currency: v.string(),
    inviteCode: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite_code", ["inviteCode"]),

  memberships: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_household", ["householdId"])
    .index("by_user", ["userId"])
    .index("by_household_and_user", ["householdId", "userId"]),

  invitations: defineTable({
    householdId: v.id("households"),
    invitedByUserId: v.id("users"),
    email: v.string(),
    code: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_code", ["code"])
    .index("by_email", ["email"]),

  categories: defineTable({
    householdId: v.optional(v.id("households")),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    isSystem: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_system", ["isSystem"]),

  subcategories: defineTable({
    categoryId: v.id("categories"),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    icon: v.string(),
    isSystem: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_household", ["householdId"]),

  user_profiles: defineTable({
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    avatarImageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  expenses: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
    categoryId: v.id("categories"),
    subcategoryId: v.id("subcategories"),
    amount: v.number(),
    date: v.number(),
    description: v.string(),
    receiptImageId: v.optional(v.id("_storage")),
    ocrRawText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_date", ["householdId", "date"])
    .index("by_household_and_category", ["householdId", "categoryId"])
    .index("by_household_and_subcategory", ["householdId", "subcategoryId"])
    .index("by_user", ["userId"]),

  // Budget limits per category per household
  category_budgets: defineTable({
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    limitAmount: v.number(), // in cents
    period: v.union(v.literal("month"), v.literal("week")),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_category", ["householdId", "categoryId"]),

  // Household income settings
  household_income: defineTable({
    householdId: v.id("households"),
    // Total monthly net income for the household (in cents)
    monthlyAmount: v.number(),
    // Optional: per-member contributions
    memberContributions: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          amount: v.number(), // in cents
          label: v.optional(v.string()), // e.g. "Salary", "Freelance"
        })
      )
    ),
    updatedAt: v.number(),
  }).index("by_household", ["householdId"]),

  // AI-generated insights persisted per household
  ai_insights: defineTable({
    householdId: v.id("households"),
    generatedAt: v.number(),
    insights: v.array(
      v.object({
        type: v.string(),
        title: v.string(),
        body: v.string(),
        emoji: v.string(),
        severity: v.union(v.literal("info"), v.literal("warning"), v.literal("danger")),
      })
    ),
    dataHash: v.string(),
  })
    .index("by_household", ["householdId"]),

  // Unique email token per household for email forwarding
  email_tokens: defineTable({
    householdId: v.id("households"),
    token: v.string(), // unique slug, e.g. "abc123xyz"
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_token", ["token"]),

  // Pending expenses parsed from forwarded emails, awaiting user review
  pending_email_expenses: defineTable({
    householdId: v.id("households"),
    emailFrom: v.string(),
    emailSubject: v.string(),
    emailReceivedAt: v.number(),
    rawEmailText: v.string(),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(), // in cents
        categoryId: v.optional(v.string()),
        subcategoryId: v.optional(v.string()),
        confidence: v.optional(v.string()), // "high" | "low"
      })
    ),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedAt: v.optional(v.number()),
    reviewedByUserId: v.optional(v.id("users")),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_status", ["householdId", "status"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
