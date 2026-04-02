import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Bot, ShoppingCart, Send, Plus, Check, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  householdId: Id<"households">;
}

type Tab = "chat" | "shopping";

export function ChatScreen({ householdId }: Props) {
  const [tab, setTab] = useState<Tab>("chat");

  const shoppingList = useQuery(api.shopping.listForHousehold, { householdId }) ?? [];
  const unboughtCount = shoppingList.filter(i => !i.isBought).length;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] pb-2 relative">
      {/* Header and Toggle */}
      <div className="pt-2 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4 drop-shadow-sm">
          <Bot className="w-8 h-8 text-[#c76823]" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a]">Agent</h2>
        </div>

        <div className="flex bg-[#fdf9f1] rounded-2xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1">
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
              tab === "chat"
                ? "bg-white text-[#cf833f] shadow-sm transform scale-[1.02]"
                : "text-[#8a7262] hover:bg-white/50"
            }`}
          >
            <Bot className="w-4 h-4" />
            Rozmowa
          </button>
          <button
            onClick={() => setTab("shopping")}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 relative ${
              tab === "shopping"
                ? "bg-white text-[#cf833f] shadow-sm transform scale-[1.02]"
                : "text-[#8a7262] hover:bg-white/50"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Lista zakupów
            {unboughtCount > 0 && (
              <span className="bg-[#cf833f] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center absolute top-2 right-4 shadow-sm animate-pulse">
                {unboughtCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === "chat" ? <ChatView householdId={householdId} /> : <ShoppingListView householdId={householdId} items={shoppingList} />}
    </div>
  );
}

function ChatView({ householdId }: { householdId: Id<"households"> }) {
  const messages = useQuery(api.chat.listForHousehold, { householdId });
  const sendMessage = useAction(api.chatNode.sendMessage);
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    
    const text = input;
    setInput("");
    setIsTyping(true);

    try {
       await sendMessage({ householdId, text });
    } catch(err) {
       toast.error("Błąd podczas wysyłania wiadomości.");
    } finally {
       setIsTyping(false);
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-[0_8px_32px_rgba(180,120,80,0.15)] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages?.map((msg) => {
          const isMe = msg.role === "user";
          return (
            <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[1.2rem] px-4 py-3 shadow-sm ${
                  isMe
                    ? "bg-[#cf833f] text-white rounded-br-sm"
                    : "bg-white text-[#2b180a] border border-[#f5e5cf] rounded-bl-sm"
                }`}
              >
                {isMe ? (
                  <span className="text-[13px] font-semibold block leading-relaxed">{msg.text}</span>
                ) : (
                  <div className="text-[13px] font-medium leading-relaxed prose prose-sm prose-orange">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white text-[#8a7262] border border-[#f5e5cf] rounded-[1.2rem] rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
               <div className="w-1.5 h-1.5 bg-[#cf833f] rounded-full animate-bounce"></div>
               <div className="w-1.5 h-1.5 bg-[#cf833f] rounded-full animate-bounce delay-100"></div>
               <div className="w-1.5 h-1.5 bg-[#cf833f] rounded-full animate-bounce delay-200"></div>
             </div>
           </div>
        )}
        <div ref={endRef} className="h-2" />
      </div>

      <div className="p-3 bg-white/60 border-t border-white/50">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Zapytaj o przepis..."
            className="flex-1 bg-white border border-[#f5e5cf] rounded-full px-4 py-3 text-sm font-semibold outline-none focus:border-[#cf833f] text-[#2b180a] shadow-inner"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 bg-gradient-to-br from-[#de9241] to-[#ca782a] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex-shrink-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ShoppingListView({ householdId, items }: { householdId: Id<"households">; items: any[] }) {
  const [newItem, setNewItem] = useState("");
  const add = useMutation(api.shopping.add);
  const toggle = useMutation(api.shopping.toggleBuy);
  const remove = useMutation(api.shopping.remove);
  const clearBought = useMutation(api.shopping.clearBought);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await add({ householdId, name: newItem.trim(), addedByAction: "User" });
      setNewItem("");
    } catch(err) {} 
  }

  const unbought = items.filter(i => !i.isBought);
  const bought = items.filter(i => i.isBought);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-[0_8px_32px_rgba(180,120,80,0.15)] relative">
      <div className="p-4 bg-white/60 border-b border-white/50">
        <form onSubmit={handleAdd} className="flex gap-2">
           <input 
             type="text" 
             value={newItem}
             onChange={e => setNewItem(e.target.value)}
             placeholder="Dodaj ręcznie np. Mleko" 
             className="flex-1 bg-white border border-[#f5e5cf] rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-[#cf833f] shadow-inner"
           />
           <button type="submit" disabled={!newItem.trim()} className="px-4 bg-[#cf833f] text-white rounded-xl shadow-sm hover:bg-[#c76823] disabled:opacity-50 font-bold">
             <Plus className="w-5 h-5" />
           </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide space-y-6">
        {unbought.length === 0 && bought.length === 0 && (
           <div className="text-center py-10 opacity-70">
             <ShoppingCart className="w-12 h-12 text-[#c76823] mx-auto mb-2 opacity-50" />
             <p className="text-sm font-bold text-[#8a7262]">Lista zakupów jest pusta</p>
             <p className="text-xs font-semibold text-[#b89b87] mt-1">Sztuczna Inteligencja może ją dla Ciebie wypełnić!</p>
           </div>
        )}

        {unbought.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1">Do kupienia</h4>
            {unbought.map(item => (
              <div key={item._id} className="group flex items-center justify-between p-3 bg-white border border-[#f5e5cf] rounded-2xl shadow-sm">
                 <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle({ householdId, itemId: item._id, isBought: true })}>
                   <div className="w-6 h-6 border-2 border-[#cf833f] rounded-lg flex items-center justify-center as transition-all group-hover:bg-[#fcf4e4]">
                      <Square className="w-4 h-4 text-transparent" />
                   </div>
                   <span className="text-sm font-extrabold text-[#2b180a]">{item.name}</span>
                 </div>
                 <button onClick={() => remove({ householdId, itemId: item._id })} className="p-2 text-zinc-300 hover:text-red-400 rounded-lg">
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>
            ))}
          </div>
        )}

        {bought.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mt-6 mb-2">
              <h4 className="text-[11px] font-bold text-[#b89b87] uppercase tracking-wider ml-1">Kupione</h4>
              <button onClick={() => clearBought({ householdId })} className="text-[10px] font-extrabold text-red-400 hover:underline">Wyczyść kupione</button>
            </div>
            {bought.map(item => (
              <div key={item._id} className="flex items-center justify-between p-3 bg-white/50 border border-[#f5e5cf]/50 rounded-2xl">
                 <div className="flex items-center gap-3 cursor-pointer opacity-50" onClick={() => toggle({ householdId, itemId: item._id, isBought: false })}>
                   <div className="w-6 h-6 bg-[#4aad6f] border-2 border-[#4aad6f] rounded-lg flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                   </div>
                   <span className="text-sm font-extrabold text-[#2b180a] line-through">{item.name}</span>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
