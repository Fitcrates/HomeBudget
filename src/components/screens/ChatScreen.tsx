import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Bot, ShoppingCart, Send, Plus, Check, Square, X, MessageCircle, Trash2, Loader2, Menu } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface Props {
  householdId: Id<"households">;
}

type ChatTab = "chat" | "shopping";

export function ChatScreen({ householdId }: Props) {
  const [tab, setTab] = useState<ChatTab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shoppingList = useQuery(api.shopping.listForHousehold, { householdId }) ?? [];
  const unboughtCount = shoppingList.filter(i => !i.isBought).length;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#fef8f0] to-[#f9ede0]">
      {/* SIDEBAR - Historia czatów / Lista zakupów */}
      <div
        className={`flex-shrink-0 border-r border-[#e8d5c4] bg-white/60 backdrop-blur-sm transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0'
          } overflow-hidden`}
      >
        <div className="flex h-full w-72 flex-col">
          {/* Sidebar Header */}
          <div className="border-b border-[#e8d5c4] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#2b180a]">
                {tab === "chat" ? "Rozmowy" : "Zakupy"}
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl p-1.5 text-[#8a7262] hover:bg-[#f5e5cf]/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === "chat" ? (
              <ChatSidebar householdId={householdId} />
            ) : (
              <ShoppingSidebar householdId={householdId} items={shoppingList} />
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-[#e8d5c4] bg-white/40 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2 text-[#8a7262] hover:bg-[#f5e5cf]/50"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#de9241] to-[#ca782a] shadow-sm">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-black text-[#2b180a]">Agent Domowy</h1>
              <p className="text-xs font-semibold text-[#8a7262]">Twój asystent rodzinny</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTab("chat")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${tab === "chat"
                  ? "bg-[#cf833f] text-white shadow-sm"
                  : "bg-[#f5e5cf]/40 text-[#8a7262] hover:bg-[#f5e5cf]/70"
                }`}
            >
              <Bot className="h-4 w-4" />
              Czat
            </button>
            <button
              onClick={() => setTab("shopping")}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${tab === "shopping"
                  ? "bg-[#cf833f] text-white shadow-sm"
                  : "bg-[#f5e5cf]/40 text-[#8a7262] hover:bg-[#f5e5cf]/70"
                }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Lista
              {unboughtCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {unboughtCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 overflow-hidden">
          {tab === "chat" ? (
            <ChatMainView householdId={householdId} />
          ) : (
            <ShoppingMainView householdId={householdId} items={shoppingList} />
          )}
        </div>
      </div>
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

// Funkcja generująca tytuł czatu na podstawie pierwszej wiadomości użytkownika
function generateChatTitle(firstMessage: string): string {
  const text = firstMessage.trim().toLowerCase();

  if (/przepis|gotowa[ćc]|ugotowa[ćc]|zrobi[ćc]|przygotowa[ćc]|upiec|usma[żz]y[ćc]/.test(text)) {
    return "🍳 Przepis";
  }
  if (/zakup|kupi[ćc]|sklep|list[aę]|produkt|potrzeb/.test(text)) {
    return "🛒 Zakupy";
  }
  if (/bud[żz]et|wydatk|oszcz[ęe]dno[śs][ćc]|pieni[ąa]dz|koszt|p[łl]aci[ćc]|zap[łl]aci[ćc]/.test(text)) {
    return "💰 Budżet";
  }
  if (/posi[łl]|obiad|[śs]niadanie|kolacj|lunch|jedzenie|menu/.test(text)) {
    return "🍽️ Posiłki";
  }
  if (/jak|co|dlaczego|kiedy|gdzie|czy|pomoc|porad|sugest/.test(text)) {
    return "💡 Pytanie";
  }

  const shortText = firstMessage.slice(0, 25);
  return shortText.length < firstMessage.length ? `${shortText}...` : shortText;
}

// SIDEBAR - Historia czatów
function ChatSidebar({ householdId }: { householdId: Id<"households"> }) {
  const sessions = useQuery(api.chat.listSessions, { householdId });
  const createSession = useMutation(api.chat.createSession);
  const deleteSession = useMutation(api.chat.deleteSession);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<Id<"chat_sessions"> | null>(null);

  async function handleNewChat() {
    await createSession({ householdId, title: "Nowa rozmowa" });
  }

  async function handleDeleteSession(sessionId: Id<"chat_sessions">) {
    try {
      await deleteSession({ householdId, sessionId });
      toast.success("Czat usunięty");
    } catch (err: any) {
      toast.error("Nie udało się usunąć");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#de9241] to-[#ca782a] px-4 py-3 text-sm font-black text-white shadow-md transition-all hover:shadow-lg active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nowa rozmowa
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {sessions?.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-[#b89b87]">Brak rozmów</p>
            <p className="mt-1 text-xs text-[#d8bda6]">Rozpocznij nową</p>
          </div>
        )}

        {sessions?.map((session) => (
          <div
            key={session._id}
            className="group relative rounded-xl border border-transparent bg-white/40 transition-all hover:bg-white/70"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-bold text-[#2b180a]">
                {session.title}
              </p>
              <p className="mt-0.5 text-xs text-[#8a7262]">
                {new Date(session.updatedAt).toLocaleDateString('pl-PL', {
                  day: 'numeric',
                  month: 'short'
                })}
              </p>
            </div>
            <button
              onClick={() => setPendingDeleteSessionId(session._id)}
              className="absolute right-2 top-2 rounded-md p-1 text-[#8a7262] opacity-0 transition-opacity hover:bg-red-100 hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteSessionId)}
        title="Usunąć rozmowę?"
        description="Wszystkie wiadomości zostaną trwale usunięte."
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

// SIDEBAR - Lista zakupów (kompaktowa)
function ShoppingSidebar({ householdId, items }: { householdId: Id<"households">; items: any[] }) {
  const toggle = useMutation(api.shopping.toggleBuy);
  const clearBought = useMutation(api.shopping.clearBought);

  const unbought = items.filter(i => !i.isBought);
  const bought = items.filter(i => i.isBought);

  return (
    <div className="flex h-full flex-col">
      {bought.length > 0 && (
        <div className="border-b border-[#e8d5c4] p-3">
          <button
            onClick={() => clearBought({ householdId })}
            className="w-full rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-100"
          >
            Wyczyść kupione ({bought.length})
          </button>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {unbought.length === 0 && bought.length === 0 && (
          <div className="py-8 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-[#d8bda6]" />
            <p className="mt-3 text-sm font-semibold text-[#b89b87]">Lista pusta</p>
          </div>
        )}

        {unbought.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#8a7262]">
              Do kupienia ({unbought.length})
            </h4>
            <div className="space-y-1">
              {unbought.map(item => (
                <button
                  key={item._id}
                  onClick={() => toggle({ householdId, itemId: item._id, isBought: true })}
                  className="flex w-full items-center gap-2 rounded-xl bg-white/60 p-2 text-left transition-all hover:bg-white"
                >
                  <Square className="h-4 w-4 flex-shrink-0 text-[#cf833f]" />
                  <span className="truncate text-sm font-semibold text-[#2b180a]">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {bought.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#8a7262]">
              Kupione ({bought.length})
            </h4>
            <div className="space-y-1">
              {bought.map(item => (
                <button
                  key={item._id}
                  onClick={() => toggle({ householdId, itemId: item._id, isBought: false })}
                  className="flex w-full items-center gap-2 rounded-xl bg-white/30 p-2 text-left opacity-60 transition-all hover:opacity-100"
                >
                  <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
                  <span className="truncate text-sm font-semibold text-[#2b180a] line-through">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// MAIN VIEW - Czat
function ChatMainView({ householdId }: { householdId: Id<"households"> }) {
  const sessions = useQuery(api.chat.listSessions, { householdId });
  const updateSessionTitle = useMutation(api.chat.updateSessionTitle);
  const [activeSessionId, setActiveSessionId] = useState<Id<"chat_sessions"> | null>(null);

  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0]._id);
    }
  }, [sessions, activeSessionId]);

  if (!activeSessionId || !sessions || sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-[#fff4df] to-[#f5c48e]">
            <MessageCircle className="h-10 w-10 text-[#cf833f]" />
          </div>
          <h3 className="text-xl font-black text-[#2b180a]">Witaj w Agencie Domowym!</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#8a7262]">
            Rozpocznij rozmowę, aby zapytać o przepisy, zaplanować posiłki lub zarządzać listą zakupów.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ActiveChatSession
      householdId={householdId}
      sessionId={activeSessionId}
      onFirstMessage={(text) => {
        const title = generateChatTitle(text);
        updateSessionTitle({ householdId, sessionId: activeSessionId, title });
      }}
    />
  );
}

// MAIN VIEW - Lista zakupów
function ShoppingMainView({ householdId, items }: { householdId: Id<"households">; items: any[] }) {
  const [newItem, setNewItem] = useState("");
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<Id<"shopping_items"> | null>(null);
  const add = useMutation(api.shopping.add);
  const toggle = useMutation(api.shopping.toggleBuy);
  const remove = useMutation(api.shopping.remove);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await add({ householdId, name: newItem.trim(), addedByAction: "User" });
      setNewItem("");
    } catch (err) { }
  }

  const unbought = items.filter(i => !i.isBought);
  const bought = items.filter(i => i.isBought);

  async function handleDeleteItem(itemId: Id<"shopping_items">) {
    try {
      await remove({ householdId, itemId });
      toast.success("Produkt usunięty");
    } catch (err: any) {
      toast.error("Nie udało się usunąć");
    }
  }

  return (
    <div className="flex h-full flex-col bg-white/30">
      {/* Add Item Form */}
      <div className="border-b border-[#e8d5c4] bg-white/50 p-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Dodaj produkt..."
            className="flex-1 rounded-xl border border-[#e8d5c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b180a] outline-none transition-all placeholder:text-[#d8bda6] focus:border-[#cf833f]"
          />
          <button
            type="submit"
            disabled={!newItem.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#de9241] to-[#ca782a] text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Items List */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {unbought.length === 0 && bought.length === 0 && (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-[#fff4df] to-[#f5c48e]">
              <ShoppingCart className="h-10 w-10 text-[#cf833f]" />
            </div>
            <p className="text-lg font-black text-[#2b180a]">Lista jest pusta</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8a7262]">
              Dodaj produkty ręcznie lub poproś Agenta o przygotowanie listy.
            </p>
          </div>
        )}

        {unbought.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#8a7262]">
              Do kupienia ({unbought.length})
            </h4>
            {unbought.map(item => (
              <div key={item._id} className="group flex items-center justify-between rounded-xl border border-[#e8d5c4] bg-white p-3 transition-all hover:shadow-sm">
                <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" onClick={() => toggle({ householdId, itemId: item._id, isBought: true })}>
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-xl border-2 border-[#cf833f]">
                    <Square className="h-4 w-4 text-transparent" />
                  </div>
                  <span className="truncate text-sm font-bold text-[#2b180a]">{item.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDeleteItemId(item._id)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[#d8bda6] transition-colors hover:bg-red-50 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {bought.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#8a7262]">
              Kupione ({bought.length})
            </h4>
            {bought.map(item => (
              <div key={item._id} className="flex items-center justify-between rounded-xl border border-[#e8d5c4]/50 bg-white/50 p-3 opacity-60">
                <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" onClick={() => toggle({ householdId, itemId: item._id, isBought: false })}>
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-xl bg-green-500">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <span className="truncate text-sm font-bold text-[#2b180a] line-through">{item.name}</span>
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
    </div>
  );
}

// Aktywna sesja czatu
function ActiveChatSession({
  householdId,
  sessionId,
  onFirstMessage
}: {
  householdId: Id<"households">;
  sessionId: Id<"chat_sessions">;
  onFirstMessage?: (text: string) => void;
}) {
  const messages = useQuery(api.chat.listSessionMessages, { householdId, sessionId });
  const sendMessage = useAction(api.chatNode.sendMessage);
  const resolveAction = useMutation(api.chat.resolvePendingAction);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasSetTitle, setHasSetTitle] = useState(false);
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

    if (!hasSetTitle && messages?.length === 0 && onFirstMessage) {
      onFirstMessage(text);
      setHasSetTitle(true);
    }

    try {
      await sendMessage({ householdId, sessionId, text });
    } catch (err) {
      toast.error("Błąd podczas wysyłania");
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white/30">
      {/* Messages Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages?.length === 0 && !isTyping && (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-[#fff4df] to-[#f5c48e]">
              <MessageCircle className="h-10 w-10 text-[#cf833f]" />
            </div>
            <p className="text-lg font-black text-[#2b180a]">O co chcesz zapytać?</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8a7262]">
              Możesz poprosić o przepis, plan posiłków lub pomoc z budżetem.
            </p>
          </div>
        )}

        {messages?.map((msg) => {
          const isMe = msg.role === "user";
          return (
            <div key={msg._id} className={`flex gap-3 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe && (
                <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2b180a] to-[#7b4b28] shadow-sm">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              <div className={`flex max-w-[75%] flex-col gap-2 ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-xl px-4 py-3 shadow-sm ${isMe
                      ? "rounded-br-sm bg-gradient-to-br from-[#de9241] to-[#ca782a] text-white"
                      : "rounded-bl-sm border border-[#e8d5c4] bg-white text-[#2b180a]"
                    }`}
                >
                  {isMe ? (
                    <span className="text-sm font-medium leading-relaxed">{msg.text}</span>
                  ) : (
                    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-[#2b180a]">
                      <ReactMarkdown components={{ li: InteractiveListItem }}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.pendingAction && (
                  <div className="max-w-full rounded-xl border border-[#f5d1aa] bg-[#fffaf3] p-3 shadow-sm">
                    <div className="flex flex-col gap-2">
                      {msg.pendingAction.type === "clear_shopping_list" && (
                        <>
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-red-500" />
                            <p className="text-xs font-bold text-[#cf833f]">
                              Wyczyścić listę zakupów?
                            </p>
                          </div>
                          <div className="mt-1 flex gap-2">
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "approved" })}
                              className="flex-1 rounded-xl bg-red-500 py-2 text-xs font-bold text-white"
                            >
                              Wyczyść
                            </button>
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "rejected" })}
                              className="flex-1 rounded-xl bg-gray-100 py-2 text-xs font-bold text-[#8a7262]"
                            >
                              Odrzuć
                            </button>
                          </div>
                        </>
                      )}
                      {msg.pendingAction.type === "add_shopping_list" && (
                        <>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-[#cf833f]" />
                            <p className="text-xs font-bold text-[#cf833f]">
                              Dodać {msg.pendingAction.data?.items?.length} produktów?
                            </p>
                          </div>
                          <div className="mt-1 flex gap-2">
                            <button
                              onClick={async () => {
                                for (const item of msg.pendingAction?.data?.items || []) {
                                  await addItem({ householdId, name: String(item), addedByAction: "AI_Agent" });
                                }
                                await resolveAction({ householdId, messageId: msg._id, status: "approved" });
                                toast.success("Produkty dodane");
                              }}
                              className="flex-1 rounded-xl bg-[#cf833f] py-2 text-xs font-bold text-white"
                            >
                              Dodaj
                            </button>
                            <button
                              onClick={() => resolveAction({ householdId, messageId: msg._id, status: "rejected" })}
                              className="flex-1 rounded-xl bg-gray-100 py-2 text-xs font-bold text-[#8a7262]"
                            >
                              Odrzuć
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {msg.pendingAction.status === "approved" && (
                      <div className="mt-2 flex w-max items-center gap-1 rounded-xl bg-green-50 px-2 py-1 text-xs font-bold text-green-600">
                        <Check className="h-3 w-3" /> Zaakceptowano
                      </div>
                    )}
                    {msg.pendingAction.status === "rejected" && (
                      <div className="mt-2 flex w-max items-center gap-1 rounded-xl bg-red-50 px-2 py-1 text-xs font-bold text-red-500">
                        <X className="h-3 w-3" /> Odrzucono
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isMe && (
                <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f4c086] to-[#de9241] shadow-sm">
                  <span className="text-xs font-black text-white">Ty</span>
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2b180a] to-[#7b4b28] shadow-sm">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-2 rounded-xl rounded-bl-sm border border-[#e8d5c4] bg-white px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#cf833f]" />
              <span className="text-xs font-semibold text-[#8a7262]">Myślę...</span>
            </div>
          </div>
        )}
        <div ref={endRef} className="h-2" />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#e8d5c4] bg-white/50 p-4">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Napisz wiadomość..."
            className="flex-1 rounded-xl border border-[#e8d5c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b180a] outline-none transition-all placeholder:text-[#d8bda6] focus:border-[#cf833f]"
            disabled={isTyping || isLimitReached}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || isLimitReached}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#de9241] to-[#ca782a] text-white shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Send className="ml-0.5 h-5 w-5" />
          </button>
        </form>
        {isLimitReached && (
          <p className="mt-2 text-center text-xs font-semibold text-red-500">
            Limit 30 wiadomości. Rozpocznij nowy czat.
          </p>
        )}
      </div>
    </div>
  );
}
