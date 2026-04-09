import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Groq } from "groq-sdk";

export const sendMessage = action({
  args: {
    householdId: v.id("households"),
    sessionId: v.id("chat_sessions"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Add user message
    await ctx.runMutation(api.chat.addMessage, {
      householdId: args.householdId,
      sessionId: args.sessionId,
      role: "user",
      text: args.text,
    });

    // 2. Load context
    const history = await ctx.runQuery(api.chat.listSessionMessages, { 
       householdId: args.householdId, 
       sessionId: args.sessionId 
    });
    const shoppingList = await ctx.runQuery(api.shopping.listForHousehold, { householdId: args.householdId });

    const now = new Date();
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

    const monthExpenses = await ctx.runQuery(api.expenses.list, {
      householdId: args.householdId,
      dateFrom: monthFrom,
      dateTo: monthTo,
      limit: 500,
    });

    // Group expenses by category and then subcategory
    const catMap = new Map<string, { total: number; name: string; subs: Map<string, { total: number; name: string }> }>();
    
    for (const exp of monthExpenses) {
      if (!exp.category) continue;
      const catId = exp.category._id;
      const catName = exp.category.name;
      const subName = exp.subcategory?.name || "Inne";
      const amount = exp.amount; // stored in cents

      if (!catMap.has(catId)) {
        catMap.set(catId, { total: 0, name: catName, subs: new Map() });
      }
      const c = catMap.get(catId)!;
      c.total += amount;

      if (!c.subs.has(subName)) {
        c.subs.set(subName, { total: 0, name: subName });
      }
      c.subs.get(subName)!.total += amount;
    }

    let financialInfo = "";
    if (catMap.size === 0) {
      financialInfo = "Brak wydatków w tym miesiącu.";
    } else {
      for (const [_, c] of Array.from(catMap.entries())) {
         financialInfo += `- ${c.name} (Razem: ${(c.total / 100).toFixed(2)} PLN)\n`;
         for (const [_, s] of Array.from(c.subs.entries())) {
           financialInfo += `   * ${s.name}: ${(s.total / 100).toFixed(2)} PLN\n`;
         }
      }

      financialInfo += `\nOstatnie (pojedyncze) zakupy (z paragonów i ręcznych):\n`;
      const recent = monthExpenses.slice(0, 20);
      for (const e of recent) {
         const name = e.ocrRawText || e.description || "Zakupy";
         financialInfo += `- ${name}: ${(e.amount / 100).toFixed(2)} PLN\n`;
      }
    }

    // 3. Prepare system prompt
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const unboughtItems = shoppingList.filter(i => !i.isBought).map(i => i.name).join(", ");
    
    const systemPrompt = `Jesteś bardzo bystrym, domowym asystentem AI ds. budżetu i zakupów. Jesteś pomocny, ciepły i zwięzły w swoich wypowiedziach.
Twoje główne zadania to pomaganie w planowaniu posiłków, sugerowaniu oszczędności, analizie wydatków oraz doradzaniu.

Masz dostęp do finansów rodziny na ten miesiąc:
${financialInfo}

Masz dostęp do aktualnej LISTY ZAKUPÓW: [${unboughtItems || "Pusta"}]

Jeśli użytkownik pyta o finanse, odnieś się do powyższych wydatków. Wyczuwaj nastroje - jeśli dużo wydali na rozrywkę, zasugeruj np. spędzenie czasu w domu i podsuń przepis.
Jeśli użytkownik poprosi o dodanie czegoś do listy zakupów (lub odczytasz, że potrzebuje składników do przepisu, który mu podałeś), MUSISZ na samym końcu swojej odpowiedzi dopisać specjalny blok JSON w tagach <JSON>...</JSON>. Możesz też poprosić o wyczyszczenie całej aktualnej listy jeśli użytkownik o to poprosi:
<JSON>
{ "shopping_add": ["mleko", "jajka", "chleb"], "shopping_clear": true }
</JSON>

Nigdy nie wymieniaj w bloku JSON elementów, które już są na liście zakupów. Bądź miły. Zawsze używaj języka polskiego. Jeśli użytkownik prosi o usunięcie poprzednich produktów (np. bo zmieniono przepis), dodaj w JSON klucz "shopping_clear": true. Nigdy nie usuwasz sam - zawsze po prostu to sugerujesz przez JSON. Podając przepisy, wymieniaj kroki przygotowania jako lista numerowana lub wypunktowana.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];
    
    // Add last 10 messages to keep context window small enough
    const contextHistory = history.slice(-10).map(m => ({
      role: m.role,
      content: m.text,
    }));
    messages.push(...contextHistory);

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.6,
      });

      const reply = completion.choices[0]?.message?.content || "";
      
      // Parse JSON actions if present
      let finalReply = reply;
      let pendingAction: any = undefined;
      const jsonMatch = reply.match(/<JSON>([\s\S]*?)<\/JSON>/);
      
      if (jsonMatch) {
         try {
           const actions = JSON.parse(jsonMatch[1]);
           if (actions.shopping_clear) {
              pendingAction = { type: "clear_shopping_list", status: "pending" };
           } else if (actions.shopping_add && Array.isArray(actions.shopping_add) && actions.shopping_add.length > 0) {
              pendingAction = { 
                type: "add_shopping_list", 
                status: "pending", 
                data: { items: actions.shopping_add } 
              };
           }
         } catch (e) {
           console.error("Failed to parse AI action JSON", e);
         }
         // Remove json block from final printed reply
         finalReply = reply.replace(/<JSON>[\s\S]*?<\/JSON>/g, "").trim();
      }

      await ctx.runMutation(api.chat.addMessage, {
        householdId: args.householdId,
        sessionId: args.sessionId,
        role: "assistant",
        text: finalReply,
        pendingAction,
      });

    } catch (error) {
      console.error(error);
      await ctx.runMutation(api.chat.addMessage, {
        householdId: args.householdId,
        sessionId: args.sessionId,
        role: "assistant",
        text: "Przepraszam, mam chwilowe problemy z serwerem. Spróbuj za moment.",
      });
    }
  },
});
