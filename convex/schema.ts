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
    financialRole: v.optional(
      v.union(v.literal("parent"), v.literal("partner"), v.literal("child"))
    ),
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
    isSubscription: v.optional(v.boolean()),
    sourcePendingEmailExpenseId: v.optional(v.id("pending_email_expenses")),
    sourceProviderMessageId: v.optional(v.string()),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_date", ["householdId", "date"])
    .index("by_household_user_date", ["householdId", "userId", "date"])
    .index("by_household_and_category", ["householdId", "categoryId"])
    .index("by_household_and_subcategory", ["householdId", "subcategoryId"])
    .index("by_source_pending_email_expense_id", ["sourcePendingEmailExpenseId"])
    .index("by_household_and_source_provider_message_id", ["householdId", "sourceProviderMessageId"])
    .index("by_household_and_receipt_image_id", ["householdId", "receiptImageId"])
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

  person_budgets: defineTable({
    householdId: v.id("households"),
    userId: v.id("users"),
    limitAmount: v.number(), // in cents
    period: v.union(v.literal("month"), v.literal("week")),
    updatedByUserId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_user", ["householdId", "userId"])
    .index("by_user", ["userId"]),

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

  // Forwarding inbox assigned to a household.
  email_inboxes: defineTable({
    householdId: v.id("households"),
    provider: v.union(v.literal("resend")),
    alias: v.string(),
    address: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReceivedAt: v.optional(v.number()),
  })
    .index("by_household", ["householdId"])
    .index("by_alias", ["alias"])
    .index("by_address", ["address"]),

  // Pending expenses parsed from forwarded emails, awaiting user review
  pending_email_expenses: defineTable({
    householdId: v.id("households"),
    providerMessageId: v.string(),
    sourceType: v.optional(v.union(v.literal("email"), v.literal("manual_ocr"))),
    createdByUserId: v.optional(v.id("users")),
    emailFrom: v.string(),
    emailTo: v.string(),
    emailSubject: v.string(),
    emailReceivedAt: v.number(),
    rawEmailText: v.string(),
    rawEmailHtml: v.optional(v.string()),
    ocrRawText: v.optional(v.string()),
    ocrDebugJson: v.optional(v.string()),
    matchedInboxAddress: v.string(),
    detectedBy: v.union(v.literal("ocr"), v.literal("text"), v.literal("fallback")),
    sourceSummary: v.optional(v.string()),
    attachmentNames: v.array(v.string()),
    storageIds: v.array(v.id("_storage")),
    scanStatus: v.optional(v.union(v.literal("processing"), v.literal("ready"), v.literal("failed"))),
    scanError: v.optional(v.string()),
    queuedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(), // in cents
        categoryId: v.optional(v.id("categories")),
        subcategoryId: v.optional(v.id("subcategories")),
        confidence: v.optional(v.string()), // "high" | "low"
        sourceStorageId: v.optional(v.id("_storage")),
      })
    ),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    isProcessed: v.optional(v.boolean()),
    processedAt: v.optional(v.number()),
    processedExpenseIds: v.optional(v.array(v.id("expenses"))),
    reviewedAt: v.optional(v.number()),
    reviewedByUserId: v.optional(v.id("users")),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_status", ["householdId", "status"])
    .index("by_provider_message_id", ["providerMessageId"]),

  // Savings goals
  goals: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    targetAmount: v.number(), // in cents
    currentAmount: v.number(), // in cents
    deadline: v.optional(v.number()), // timestamp
    icon: v.string(), // icon name or emoji
    createdAt: v.number(),
  }).index("by_household", ["householdId"]),

  goal_contributions: defineTable({
    householdId: v.id("households"),
    goalId: v.id("goals"),
    userId: v.id("users"),
    amount: v.number(), // in cents
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_createdAt", ["householdId", "createdAt"])
    .index("by_goal", ["goalId"])
    .index("by_goal_and_createdAt", ["goalId", "createdAt"]),

  // Shopping list
  shopping_items: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    isBought: v.boolean(),
    addedByAction: v.optional(v.string()), // "AI", "User"
    createdAt: v.number(),
  }).index("by_household", ["householdId"]),

  // OCR scan logs for observability
  ocr_logs: defineTable({
    householdId: v.id("households"),
    userId: v.optional(v.id("users")),
    imageCount: v.number(),
    modelUsed: v.string(),
    itemCount: v.number(),
    totalAmount: v.optional(v.string()),
    sumMatchedTotal: v.boolean(),
    retryUsed: v.boolean(),
    latencyMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_user", ["userId"]),

  // Learning loop: stores user corrections for product names/categories
  product_mappings: defineTable({
    householdId: v.id("households"),
    rawDescription: v.string(),       // AI-returned name, e.g. "MLK ŁOWE 2%"
    correctedDescription: v.string(), // User-corrected name, e.g. "Mleko Łowickie 2%"
    categoryId: v.id("categories"),
    subcategoryId: v.id("subcategories"),
    usageCount: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_and_raw", ["householdId", "rawDescription"]),

  // AI Chat Sessions
  chat_sessions: defineTable({
    householdId: v.id("households"),
    title: v.string(), // e.g. "Przepis na lazanię"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_household", ["householdId"]),

  // AI Chat History
  chat_messages: defineTable({
    householdId: v.id("households"),
    sessionId: v.optional(v.id("chat_sessions")),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    text: v.string(),
    pendingAction: v.optional(
      v.object({
        type: v.union(v.literal("clear_shopping_list"), v.literal("add_shopping_list")),
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        data: v.optional(v.any()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_session", ["sessionId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
