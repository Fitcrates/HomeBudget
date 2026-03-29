# Email Receipt System - How It Works

## Overview
The email system allows users to forward receipts/invoices via email, which are automatically parsed by AI and added as pending expenses for review.

**IMPORTANT**: This system requires an email-to-webhook service (like Mailgun, SendGrid, or Zapier) because the webhook URL is an HTTP endpoint, not an email address.

## Architecture

```
User's Email → Email Service (Mailgun/SendGrid) → Webhook URL → Convex → AI Processing → Pending Expenses
```

## Why You Need Mailgun/SendGrid

The webhook URL looks like this:
```
https://your-deployment.convex.cloud/api/email-ingest?token=abc123xyz789
```

This is an **HTTP endpoint**, not an email address. You cannot forward emails directly to it. You need a service that:
1. Receives emails at a real email address
2. Converts them to HTTP POST requests
3. Sends them to your webhook URL

Popular services:
- **Mailgun** (recommended, free tier: 1000 emails/month)
- **SendGrid** (free tier: 100 emails/day)
- **Zapier** (easiest, but limited free tier)

## Components

### 1. `emailTokens.ts` - Token Management
**Purpose**: Manages unique email addresses for each household

**Key Functions**:
- `getOrCreate()` - Gets existing token or creates a new one for a household
- `get()` - Retrieves the current token for a household
- `regenerate()` - Creates a new token (useful if the old one is compromised)
- `findHouseholdByToken()` - Internal function to find which household owns a token

**How it works**:
1. Each household gets a unique 12-character token (e.g., "abc123xyz789")
2. This token becomes part of an email address: `abc123xyz789@your-domain.com`
3. Users forward receipts to this email address
4. The token identifies which household the expense belongs to

### 2. `emailIngest.ts` - Email Processing
**Purpose**: Receives emails, extracts expense data using AI, and saves as pending expenses

**Workflow**:
```
Email arrives → Parse with OpenAI → Extract items → Save as pending expense
```

**Key Function**: `parseAndSaveEmail()`

**Process**:
1. **Receive Email**: Gets email content (from, subject, body)
2. **Validate Token**: Checks if the token in the email address is valid
3. **AI Parsing**: Sends email content to OpenAI with prompt asking to extract:
   - Product/service descriptions
   - Amounts (in grosze/cents)
   - Confidence level (high/low)
4. **Save Pending**: Creates a `pending_email_expenses` record with:
   - Extracted items
   - Original email metadata
   - Status: "pending" (waiting for user review)

**AI Prompt Strategy**:
- Asks AI to extract only real purchases (ignore ads/newsletters)
- Amounts must be in grosze (1 zł = 100 groszy)
- Returns confidence level for each item
- Returns empty array if no expenses found

### 3. `pendingExpenses.ts` - Review & Approval
**Purpose**: Allows users to review, edit, and approve/reject email-parsed expenses

**Key Functions**:
- `listPending()` - Shows all pending expenses for review
- `approve()` - Converts pending expense to actual expenses (with user-confirmed categories)
- `reject()` - Marks expense as rejected

## User Flow

### Setup (One-time):
1. User goes to Household settings → 🏠 Dom tab
2. Sees "📧 Forward e-mail → wydatek" card
3. Clicks "Wygeneruj adres webhook"
4. System generates unique webhook URL with token
5. User chooses email service:
   - **Option 1 (Mailgun)**: Sign up → Add domain → Create route → Forward to webhook
   - **Option 2 (Gmail + Mailgun)**: Set up Mailgun + Gmail forwarding filter
   - **Option 3 (SendGrid)**: Sign up → Configure Inbound Parse → Point to webhook
   - **Option 4 (Zapier)**: Create Zap: Email trigger → Webhook action
6. User gets an email address from the service (e.g., `receipts@mydomain.mailgun.org`)
7. User saves this email in contacts

### Daily Use:
1. User receives receipt via email (from store, online shop, etc.)
2. User forwards email to their Mailgun/SendGrid email address
3. Email service converts email to HTTP POST and calls webhook
4. System automatically:
   - Parses the email
   - Extracts expense items using AI
   - Saves as "pending"
5. User opens "📧 Skrzynka" (Email Inbox) screen in app
6. User reviews parsed items:
   - Edits descriptions if needed
   - Confirms/adjusts amounts
   - Assigns categories and subcategories
7. User clicks "Approve" → Items become real expenses
   OR clicks "Reject" → Items are marked as rejected

## Benefits

1. **Automatic**: No manual entry for emailed receipts
2. **Safe**: Each household has unique token, can be regenerated if compromised
3. **Flexible**: User reviews and confirms before expenses are added
4. **Smart**: AI extracts multiple items from single email
5. **Audit Trail**: Original email text is saved for reference

## Security

- Tokens are random 12-character strings (36^12 = ~4.7 trillion combinations)
- Tokens can be regenerated anytime
- Only household members can see pending expenses
- Pending expenses require manual approval before becoming real expenses

## Example Email Processing

**Input Email**:
```
From: shop@example.com
Subject: Your order #12345
Body: 
Thank you for your purchase!
- Milk 3.2% - 5.99 PLN
- Bread - 4.50 PLN
Total: 10.49 PLN
```

**AI Extraction**:
```json
{
  "items": [
    {
      "description": "Milk 3.2%",
      "amount": 599,
      "confidence": "high"
    },
    {
      "description": "Bread",
      "amount": 450,
      "confidence": "high"
    }
  ]
}
```

**Pending Expense Created**:
- Status: pending
- Items: 2 items extracted
- User reviews → assigns categories → approves → 2 expenses created
