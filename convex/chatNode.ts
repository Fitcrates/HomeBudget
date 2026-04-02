import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Groq } from "groq-sdk";

export const sendMessage = action({
  args: {
    householdId: v.id("households"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Add user message
    await ctx.runMutation(api.chat.addMessage, {
      householdId: args.householdId,
      role: "user",
      text: args.text,
    });

    // 2. Load context
    const history = await ctx.runQuery(api.chat.listForHousehold, { householdId: args.householdId });
    const shoppingList = await ctx.runQuery(api.shopping.listForHousehold, { householdId: args.householdId });

    // 3. Prepare system prompt
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const unboughtItems = shoppingList.filter(i => !i.isBought).map(i => i.name).join(", ");
    
    const systemPrompt = `Jesteś domowym asystentem AI ds. budżetu i zakupów. Jesteś pomocny, ciepły i zwięzły w swoich wypowiedziach.
Twoje główne zadania to pomaganie w planowaniu posiłków, sugerowaniu oszczędności oraz doradzanie w zakupach.

Masz dostęp do aktualnej LISTY ZAKUPÓW: [${unboughtItems || "Pusta"}]

Jeśli użytkownik poprosi o dodanie czegoś do listy zakupów (lub odczytasz, że potrzebuje składników do przepisu, który mu podałeś), MUSISZ na samym końcu swojej odpowiedzi dopisać specjalny blok JSON w tagach <JSON>...</JSON>. Używaj ścisłego formatu:
<JSON>
{ "shopping_add": ["mleko", "jajka", "chleb"] }
</JSON>

Nigdy nie wymieniaj w bloku JSON elementów, które już są na liście zakupów. Bądź miły. Zawsze używaj języka polskiego.`;

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
      const jsonMatch = reply.match(/<JSON>([\s\S]*?)<\/JSON>/);
      
      if (jsonMatch) {
         try {
           const actions = JSON.parse(jsonMatch[1]);
           if (actions.shopping_add && Array.isArray(actions.shopping_add)) {
              for (const item of actions.shopping_add) {
                await ctx.runMutation(api.shopping.add, {
                  householdId: args.householdId,
                  name: String(item),
                  addedByAction: "AI_Agent",
                });
              }
           }
         } catch (e) {
           console.error("Failed to parse AI action JSON", e);
         }
         // Remove json block from final printed reply
         finalReply = reply.replace(/<JSON>[\s\S]*?<\/JSON>/g, "").trim();
      }

      await ctx.runMutation(api.chat.addMessage, {
        householdId: args.householdId,
        role: "assistant",
        text: finalReply,
      });

    } catch (error) {
      console.error(error);
      await ctx.runMutation(api.chat.addMessage, {
        householdId: args.householdId,
        role: "assistant",
        text: "Przepraszam, mam chwilowe problemy z serwerem. Spróbuj za moment.",
      });
    }
  },
});
