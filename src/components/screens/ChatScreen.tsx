import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Bot, ShoppingCart, Send, Plus, Check, Square, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ScreenHeader } from "../ui/ScreenHeader";
import { TabBar } from "../ui/TabBar";
import { AppCard } from "../ui/AppCard";

interface Props {
  householdId: Id<"households">;
}

type ChatTab = "chat" | "shopping";

export function ChatScreen({ householdId }: Props) {
  const [tab, setTab] = useState<ChatTab>("chat");

  const shoppingList = useQuery(api.shopping.listForHousehold, { householdId }) ?? [];
  const unboughtCount = shoppingList.filter(i => !i.isBought).length;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] pb-2 relative">
      <div className="pt-2 pb-4 flex-shrink-0">
        <ScreenHeader icon={<Bot className="w-9 h-9" />} title="Agent" />
        <TabBar
          tabs={[
            { key: "chat", label: "Rozmowa", icon: Bot },
            { 
               key: "shopping", 
               label: "Lista zakupów", 
               icon: ShoppingCart,
               badge: unboughtCount > 0 ? unboughtCount : undefined 
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "chat" ? <ChatView householdId={householdId} /> : <ShoppingListView householdId={householdId} items={shoppingList} />}
    </div>
  );
}

function InteractiveListItem({ children, ...props }: any) {
  const [done, setDone] = useState(false);
  return (
    <li 
      {...props} 
      onClick={() => setDone(!done)} 
      className={`cursor-pointer transition-all hover:bg-[#cf833f]/10 p-1.5 rounded-xl list-none flex items-start gap-2.5 -ml-4 mb-1.5 ${done ? 'opacity-40' : ''} border border-transparent hover:border-[#cf833f]/20 active:scale-[0.98] select-none touch-manipulation`}
    >
      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-[2px] transition-all flex items-center justify-center ${done ? 'bg-[#cf833f] border-[#cf833f]' : 'border-[#cf833f]/40'}`}>
        {done && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
      </span>
      <span className={`text-[14px] leading-relaxed transition-all break-words w-full pr-1 ${done ? 'line-through text-[#8a7262]' : 'text-[#2b180a]'}`}>
        {children}
      </span>
    </li>
  );
}



function ChatView({ householdId }: { householdId: Id<"households"> }) {
  const sessions = useQuery(api.chat.listSessions, { householdId });
  const createSession = useMutation(api.chat.createSession);
  const deleteSession = useMutation(api.chat.deleteSession);
  
  const [activeSessionId, setActiveSessionId] = useState<Id<"chat_sessions"> | null>(null);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<Id<"chat_sessions"> | null>(null);

  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0]._id);
    }
  }, [sessions, activeSessionId]);

  async function handleNewChat() {
    const id = await createSession({ householdId, title: "Nowa rozmowa" });
    setActiveSessionId(id);
  }

  async function handleDeleteSession(sessionId: Id<"chat_sessions">) {
    try {
      await deleteSession({ householdId, sessionId });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      toast.success("Czat usunięty.");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się usunąć czatu.");
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-3">
      {/* Sessions Bar */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0 px-1 py-0.5">
        <button
          onClick={handleNewChat}
          className="flex-shrink-0 flex items-center justify-center gap-1 bg-[#c76823] text-white text-[12px] font-bold px-3 py-1.5 rounded-full shadow-sm hover:bg-[#a6561d] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nowy Czat
        </button>
        {sessions?.map((session) => (
          <div key={session._id} className="relative group flex-shrink-0">
             <button
                onClick={() => setActiveSessionId(session._id)}
                className={`text-[12px] font-bold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1 border ${
                  activeSessionId === session._id
                    ? "bg-white text-[#c76823] border-[#f5e5cf] shadow-sm"
                    : "bg-white/40 text-[#8a7262] border-transparent hover:bg-white/60"
                }`}
              >
                {session.title}
             </button>
             <button
               type="button"
               onClick={(e) => {
                 e.stopPropagation();
                 setPendingDeleteSessionId(session._id);
               }}
               title="Usuń czat"
               aria-label="Usuń czat"
               className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border border-red-200 bg-red-100 text-red-500 shadow-sm opacity-0 transition-opacity hover:bg-red-200 group-hover:opacity-100 ${activeSessionId === session._id ? "opacity-100" : ""}`}
             >
               <X className="mx-auto h-3 w-3" />
             </button>
          </div>
        ))}
      </div>

      {/* Active Session View */}
      {activeSessionId ? (
        <ActiveChatSession householdId={householdId} sessionId={activeSessionId} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 px-6">
          <Bot className="w-12 h-12 text-[#c76823] mb-4" />
          <p className="text-[14px] font-bold text-[#8a7262]">Nie masz jeszcze żadnych rozmów.</p>
          <p className="text-[12px] text-[#b89b87] mt-1">Zacznij nową rozmowę aby zapytać Agenta o przepis z listy zakupów, albo poradę dotyczącą Twoich wydatków.</p>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteSessionId)}
        title="Usunąć czat?"
        description="Wiadomości z tej sesji zostaną trwale usunięte."
        confirmLabel="Usuń"
        onCancel={() => setPendingDeleteSessionId(null)}
        onConfirm={() => {
          if (!pendingDeleteSessionId) return;
          void handleDeleteSession(pendingDeleteSessionId);
          setPendingDeleteSessionId(null);
        }}
      />
    </div>
  );
}

function ActiveChatSession({ householdId, sessionId }: { householdId: Id<"households">; sessionId: Id<"chat_sessions"> }) {
  const messages = useQuery(api.chat.listSessionMessages, { householdId, sessionId });
  const sendMessage = useAction(api.chatNode.sendMessage);
  const resolveAction = useMutation(api.chat.resolvePendingAction);
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const addItem = useMutation(api.shopping.add);

  const isLimitReached = (messages?.length ?? 0) >= 30;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isTyping || isLimitReached) return;
    
    const text = input;
    setInput("");
    setIsTyping(true);

    try {
       await sendMessage({ householdId, sessionId, text });
    } catch(err) {
       toast.error("Błąd podczas wysyłania wiadomości.");
    } finally {
       setIsTyping(false);
    }
  }

  return (
    <AppCard padding="none" className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages?.map((msg) => {
          const isMe = msg.role === "user";
          return (
            <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col gap-1.5 items-start">
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                    isMe
                      ? "bg-[#cf833f] text-white rounded-br-sm self-end"
                      : "bg-white text-[#2b180a] border border-[#f5e5cf] rounded-bl-sm"
                  }`}
                >
                  {isMe ? (
                    <span className="text-[13px] font-medium block leading-relaxed">{msg.text}</span>
                  ) : (
                    <div className="text-[14px] font-medium leading-relaxed prose prose-sm prose-orange max-w-none text-[#2b180a]">
                      <ReactMarkdown
                        components={{
                          li: InteractiveListItem
                        }}
                      >{msg.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
                
                {msg.pendingAction && (
                  <div className="ml-2 bg-[#fdf9f1] border border-[#f5e5cf] rounded-xl p-3 shadow-sm flex flex-col gap-2 max-w-[85%]">
                    <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#8a7262]">
                      <ShoppingCart className="w-4 h-4 text-[#c76823]" />
                      {msg.pendingAction.type === "clear_shopping_list" && (
                        <>
                          <p className="text-xs font-bold text-[#cf833f] text-center w-full mb-1">
                            Agent proponuje WYCZYSZCZENIE listy zakupów. Zgadzasz się?
                          </p>
                          <div className="flex gap-2 w-full mt-2">
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "approved" })}
                              className="flex-1 bg-gradient-to-r from-red-400 to-red-500 text-white rounded-xl py-2 font-black text-[13px]"
                            >
                              Wyczyść
                            </button>
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "rejected" })}
                              className="flex-1 bg-black/5 text-[#8a7262] rounded-xl py-2 font-black text-[13px]"
                            >
                              Odrzuć
                            </button>
                          </div>
                        </>
                      )}
                      {msg.pendingAction.type === "add_shopping_list" && (
                        <>
                          <p className="text-xs font-bold text-[#cf833f] text-center w-full mb-1">
                            Agent proponuje dodanie {msg.pendingAction.data?.items?.length} produktów do listy.
                          </p>
                          <div className="flex gap-2 w-full mt-2">
                            <button
                              onClick={async () => {
                                 for (const item of msg.pendingAction?.data?.items || []) {
                                   await addItem({ householdId, name: String(item), addedByAction: "AI_Agent" });
                                 }
                                 await resolveAction({ householdId, messageId: msg._id, status: "approved" });
                                 toast.success("Produkty dodane na listę.");
                              }}
                              className="flex-1 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-xl py-2 font-black text-[13px]"
                            >
                              Zgoda
                            </button>
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "rejected" })}
                              className="flex-1 bg-black/5 text-[#8a7262] rounded-xl py-2 font-black text-[13px]"
                            >
                              Odrzuć
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {msg.pendingAction.status === "approved" && (
                      <div className="text-[11px] font-medium text-[#4aad6f] flex items-center gap-1 bg-[#dcfce7]/50 px-2 py-1 rounded w-max">
                        <Check className="w-3 h-3" /> Zgoda wydana
                      </div>
                    )}
                    {msg.pendingAction.status === "rejected" && (
                      <div className="text-[11px] font-medium text-red-400 flex items-center gap-1 bg-red-50 px-2 py-1 rounded w-max">
                        <X className="w-3 h-3" /> Odrzucono
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white text-[#8a7262] border border-[#f5e5cf] rounded-xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
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
            className="flex-1 bg-white border border-[#f5e5cf] rounded-full px-4 py-3 text-sm font-medium outline-none focus:border-[#cf833f] text-[#2b180a] shadow-inner"
            disabled={isTyping || isLimitReached}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || isLimitReached}
            className="w-12 h-12 bg-gradient-to-br from-[#de9241] to-[#ca782a] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex-shrink-0"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
        {isLimitReached && (
           <p className="text-[10px] font-bold text-red-400 mt-2 text-center">
             Osiągnięto limit 30 wiadomości na ten czat. Rozpocznij nowy, aby kontynuować rozmowę oszczędzając pamięć agenta.
           </p>
        )}
      </div>
    </AppCard>
  );
}

function ShoppingListView({ householdId, items }: { householdId: Id<"households">; items: any[] }) {
  const [newItem, setNewItem] = useState("");
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<Id<"shopping_items"> | null>(null);
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

  async function handleDeleteItem(itemId: Id<"shopping_items">) {
    try {
      await remove({ householdId, itemId });
      toast.success("Produkt usunięty.");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się usunąć produktu.");
    }
  }

  return (
    <AppCard padding="none" className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
      <div className="p-4 bg-white/60 border-b border-white/50">
        <form onSubmit={handleAdd} className="flex gap-2">
           <input 
             type="text" 
             value={newItem}
             onChange={e => setNewItem(e.target.value)}
             placeholder="Dodaj ręcznie np. Mleko" 
             className="flex-1 bg-white border border-[#f5e5cf] rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#cf833f] shadow-inner"
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
             <p className="text-xs font-medium text-[#b89b87] mt-1">Sztuczna Inteligencja może ją dla Ciebie wypełnić!</p>
           </div>
        )}

        {unbought.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1">Do kupienia</h4>
            {unbought.map(item => (
              <div key={item._id} className="group flex items-center justify-between p-3 bg-white border border-[#f5e5cf] rounded-xl shadow-sm">
                 <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle({ householdId, itemId: item._id, isBought: true })}>
                   <div className="w-6 h-6 border-2 border-[#cf833f] rounded-xl flex items-center justify-center as transition-all group-hover:bg-[#fcf4e4]">
                      <Square className="w-4 h-4 text-transparent" />
                   </div>
                   <span className="text-sm font-medium text-[#2b180a]">{item.name}</span>
                 </div>
                 <button type="button" onClick={() => setPendingDeleteItemId(item._id)} title="Usuń produkt" aria-label="Usuń produkt" className="h-7 w-7 rounded-full text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-400"><X className="mx-auto h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {bought.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mt-6 mb-2">
              <h4 className="text-[11px] font-bold text-[#b89b87] uppercase tracking-wider ml-1">Kupione</h4>
              <button onClick={() => clearBought({ householdId })} className="text-[10px] font-medium text-red-400 hover:underline">Wyczyść kupione</button>
            </div>
            {bought.map(item => (
              <div key={item._id} className="flex items-center justify-between p-3 bg-white/50 border border-[#f5e5cf]/50 rounded-xl">
                 <div className="flex items-center gap-3 cursor-pointer opacity-50" onClick={() => toggle({ householdId, itemId: item._id, isBought: false })}>
                   <div className="w-6 h-6 bg-[#4aad6f] border-2 border-[#4aad6f] rounded-xl flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                   </div>
                   <span className="text-sm font-medium text-[#2b180a] line-through">{item.name}</span>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteItemId)}
        title="Usunąć produkt?"
        description="Pozycja zniknie z listy zakupów."
        confirmLabel="Usuń"
        onCancel={() => setPendingDeleteItemId(null)}
        onConfirm={() => {
          if (!pendingDeleteItemId) return;
          void handleDeleteItem(pendingDeleteItemId);
          setPendingDeleteItemId(null);
        }}
      />
    </AppCard>
  );
}


