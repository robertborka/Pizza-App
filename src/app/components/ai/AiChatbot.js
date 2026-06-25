"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../AppContext";
import { formatDateTime, formatMoney } from "@/libs/formatters";

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content:
      "Salut! Sunt asistentul Top Family Pizza. Pot recomanda o comandă completă, pot ține cont de coș, buget, număr de persoane, ingrediente nedorite și pot verifica ultima comandă.",
    suggestedProducts: [],
    source: "Asistent",
    aiUsed: false,
    ui: {
      showProducts: false,
      showLastOrder: false,
      showAdminSnapshot: false,
      showInsights: false,
      showContact: false,
    },
  },
];

const DEFAULT_QUICK_PROMPTS = [
  "Recomandă-mi o comandă completă",
  "Ce merge cu ce am în coș?",
  "Vreau ceva sub 50 lei",
  "Suntem 3 persoane, ce recomanzi?",
  "Unde e ultima mea comandă?",
  "Vreau număr de contact",
];

function shortText(value, maxLength = 110) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

function getOrderKey(order) {
  return String(order?._id || order?.shortId || "");
}

async function readJsonResponse(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Răspuns invalid de la server. Status ${res.status}. Preview: ${text.slice(
        0,
        160
      )}`
    );
  }
}

function ProductSuggestionCard({ product, onAdd }) {
  if (!product) {
    return null;
  }

  const price = getProductPrice(product);

  return (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
          <img
            src={product.image || "/pizza.png"}
            alt={product.name || "Produs"}
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{product.name}</p>

          <p className="text-xs text-gray-500 leading-5 mt-1">
            {shortText(product.description || "Produs recomandat.", 72)}
          </p>

          <p className="font-bold text-primary mt-1">{formatMoney(price)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={() => onAdd(product)}
          className="!w-full bg-primary text-white border-0 rounded-full px-3 py-2 text-sm font-bold"
        >
          Adaugă
        </button>

        <Link
          href={`/menu/${product._id}`}
          className="inline-flex items-center justify-center border border-gray-300 text-gray-700 rounded-full px-3 py-2 text-sm font-bold hover:border-primary hover:text-primary transition"
        >
          Detalii
        </Link>
      </div>
    </div>
  );
}

function LastOrderCard({ order }) {
  if (!order) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-bold text-gray-900">Ultima comandă</p>

        <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
          {order.shortId}
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Status: <span className="font-bold">{order.status}</span>
      </p>

      <p className="text-sm text-gray-600">
        Total: <span className="font-bold">{formatMoney(order.totalPrice)}</span>
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Plasată: {formatDateTime(order.createdAt)}
      </p>

      <Link
        href="/my-orders"
        className="inline-flex mt-3 text-primary text-sm font-bold hover:underline"
      >
        Vezi comenzile mele
      </Link>
    </div>
  );
}

function ContactCard({ contactInfo }) {
  if (!contactInfo) {
    return null;
  }

  const phoneHref = `tel:${String(contactInfo.phone || "").replace(/\s+/g, "")}`;
  const emailHref = `mailto:${contactInfo.email || "topfamilypizza@gmail.com"}`;

  return (
    <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="font-bold text-gray-900">Date de contact</p>

        <span className="rounded-full bg-primary text-white px-3 py-1 text-xs font-bold">
          Suport
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-700">
        <p>
          <span className="font-bold">Restaurant:</span>{" "}
          {contactInfo.restaurant || "Top Family Pizza"}
        </p>

        <p>
          <span className="font-bold">Adresă:</span>{" "}
          {contactInfo.address || "Strada Rozelor 36B, Brașov, România"}
        </p>

        <p>
          <span className="font-bold">Telefon:</span>{" "}
          <a href={phoneHref} className="text-primary font-bold hover:underline">
            {contactInfo.phone || "0760 530 530"}
          </a>
        </p>

        <p>
          <span className="font-bold">Email:</span>{" "}
          <a href={emailHref} className="text-primary font-bold hover:underline">
            {contactInfo.email || "topfamilypizza@gmail.com"}
          </a>
        </p>
      </div>
    </div>
  );
}

function AdminSnapshotCard({ snapshot }) {
  if (!snapshot) {
    return null;
  }

  const topProduct = snapshot.topProducts?.[0];

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-bold text-gray-900">Rezumat admin</p>

        <span className="rounded-full bg-gray-950 text-white px-3 py-1 text-xs font-bold">
          Admin
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-gray-500">Comenzi</p>
          <p className="font-bold text-gray-900">{snapshot.totalOrders}</p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-gray-500">Valoare</p>
          <p className="font-bold text-primary">{formatMoney(snapshot.totalRevenue)}</p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-gray-500">Active</p>
          <p className="font-bold text-gray-900">{snapshot.activeOrders}</p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-gray-500">Anulate</p>
          <p className="font-bold text-gray-900">{snapshot.cancelledOrders}</p>
        </div>
      </div>

      {topProduct && (
        <p className="text-sm text-gray-600 mt-3">
          Top produs:{" "}
          <span className="font-bold">
            {topProduct.name} ({topProduct.quantity} buc.)
          </span>
        </p>
      )}

      <Link
        href="/admin/dashboard"
        className="inline-flex mt-3 text-primary text-sm font-bold hover:underline"
      >
        Deschide dashboard
      </Link>
    </div>
  );
}

function ChatMessage({ message, onAddProduct, onAddAllProducts }) {
  const isUser = message.role === "user";
  const ui = message.ui || {};

  const suggestedProducts =
    ui.showProducts && Array.isArray(message.suggestedProducts)
      ? message.suggestedProducts
      : [];

  const showInsights =
    ui.showInsights &&
    Array.isArray(message.insights) &&
    message.insights.length > 0;

  const showLastOrder = ui.showLastOrder && message.lastOrder;
  const showAdminSnapshot = ui.showAdminSnapshot && message.adminSnapshot;
  const showContact = ui.showContact && message.contactInfo;
  const hasWideContent = suggestedProducts.length > 0 || showAdminSnapshot;
  const sourceLabel = message.aiUsed ? "Mod inteligent" : message.source || "Asistent";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-3xl rounded-br-md bg-primary text-white px-4 py-3 shadow-sm"
            : hasWideContent
              ? "w-full max-w-full rounded-3xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-3 shadow-sm"
              : "max-w-[90%] rounded-3xl rounded-bl-md bg-gray-100 text-gray-800 px-4 py-3 shadow-sm"
        }
      >
        {!isUser && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="rounded-full bg-white border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-600">
              {sourceLabel}
            </span>

            {message.aiUsed !== undefined && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                {message.aiUsed ? "Activ" : "Reguli interne"}
              </span>
            )}
          </div>
        )}

        <p className="text-sm leading-6 whitespace-pre-line">
          {message.content}
        </p>

        {!isUser && showInsights && (
          <div className="mt-3 rounded-2xl bg-white border border-gray-200 p-3">
            <p className="text-xs uppercase tracking-wide text-primary font-bold mb-2">
              Personalizare
            </p>

            <div className="space-y-1">
              {message.insights.slice(0, 3).map((insight, index) => (
                <p key={`${insight}-${index}`} className="text-xs text-gray-600">
                  • {insight}
                </p>
              ))}
            </div>
          </div>
        )}

        {!isUser && showLastOrder && <LastOrderCard order={message.lastOrder} />}
        {!isUser && showContact && <ContactCard contactInfo={message.contactInfo} />}

        {!isUser && showAdminSnapshot && (
          <AdminSnapshotCard snapshot={message.adminSnapshot} />
        )}

        {!isUser && suggestedProducts.length > 0 && (
          <div className="mt-3">
            {suggestedProducts.length > 1 && (
              <button
                type="button"
                onClick={() => onAddAllProducts(suggestedProducts)}
                className="!w-full mb-3 bg-gray-950 text-white border-0 rounded-full px-4 py-3 text-sm font-bold"
              >
                {message.actionLabel || "Adaugă toate recomandările"}
              </button>
            )}

            <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
              {suggestedProducts.map((product) => (
                <div key={product._id} className="min-w-[260px] max-w-[260px]">
                  <ProductSuggestionCard
                    product={product}
                    onAdd={onAddProduct}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiChatbot() {
  const { cartProducts, addToCart, cartCount } = useCart();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [quickPrompts, setQuickPrompts] = useState(DEFAULT_QUICK_PROMPTS);

  const messagesEndRef = useRef(null);
  const shownLastOrderKeysRef = useRef(new Set());

  const cartTotal = useMemo(() => {
    return cartProducts.reduce((sum, product) => {
      return sum + Number(product.basePrice ?? product.price ?? 0);
    }, 0);
  }, [cartProducts]);

  useEffect(() => {
    if (!open) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending, open]);

  function showNotice(text) {
    setNotice(text);

    setTimeout(() => {
      setNotice("");
    }, 2000);
  }

  function handleAddProduct(product) {
    addToCart(product);
    showNotice(`${product.name} a fost adăugat în coș.`);
  }

  function handleAddAllProducts(products) {
    for (const product of products) {
      addToCart(product);
    }

    showNotice(`${products.length} produse au fost adăugate în coș.`);
  }

  function prepareAssistantMessage(data) {
    const ui = data.ui || {
      showProducts: false,
      showLastOrder: false,
      showAdminSnapshot: false,
      showInsights: false,
      showContact: false,
    };

    let lastOrder = data.lastOrder || null;

    const nextUi = {
      showProducts: Boolean(ui.showProducts),
      showLastOrder: Boolean(ui.showLastOrder),
      showAdminSnapshot: Boolean(ui.showAdminSnapshot),
      showInsights: Boolean(ui.showInsights),
      showContact: Boolean(ui.showContact),
    };

    if (nextUi.showLastOrder && lastOrder) {
      const orderKey = getOrderKey(lastOrder);

      if (orderKey && shownLastOrderKeysRef.current.has(orderKey)) {
        lastOrder = null;
        nextUi.showLastOrder = false;
      } else if (orderKey) {
        shownLastOrderKeysRef.current.add(orderKey);
      }
    }

    return {
      role: "assistant",
      content: data.message,
      suggestedProducts: Array.isArray(data.suggestedProducts)
        ? data.suggestedProducts
        : [],
      aiUsed: Boolean(data.aiUsed),
      source: data.source || "Asistent",
      intent: data.intent || "",
      actionLabel: data.actionLabel || "",
      insights: Array.isArray(data.insights) ? data.insights : [],
      lastOrder,
      adminSnapshot: data.adminSnapshot || null,
      contactInfo: data.contactInfo || null,
      ui: nextUi,
    };
  }

  async function sendMessage(customText) {
    const text = String(customText ?? input).trim();

    if (!text || sending) {
      return;
    }

    const userMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chatbot", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          cartProducts,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error ||
              "Nu am putut genera un răspuns acum. Încearcă din nou.",
            suggestedProducts: [],
            source: "Eroare",
            aiUsed: false,
            contactInfo: null,
            ui: {
              showProducts: false,
              showLastOrder: false,
              showAdminSnapshot: false,
              showInsights: false,
              showContact: false,
            },
          },
        ]);

        return;
      }

      if (Array.isArray(data.quickPrompts) && data.quickPrompts.length > 0) {
        setQuickPrompts(data.quickPrompts);
      }

      const assistantMessage = prepareAssistantMessage(data);

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "A apărut o eroare la conectarea cu chatbotul. Verifică serverul și încearcă din nou.",
          suggestedProducts: [],
          source: "Eroare",
          aiUsed: false,
          contactInfo: null,
          ui: {
            showProducts: false,
            showLastOrder: false,
            showAdminSnapshot: false,
            showInsights: false,
            showContact: false,
          },
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    sendMessage();
  }

  function resetChat() {
    shownLastOrderKeysRef.current = new Set();
    setMessages(INITIAL_MESSAGES);
    setInput("");
    setNotice("");
    setQuickPrompts(DEFAULT_QUICK_PROMPTS);
  }

  return (
    <>
      {notice && (
        <div className="fixed bottom-24 right-6 z-50 rounded-full bg-gray-950 text-white px-5 py-3 shadow-2xl border border-white/10 text-sm font-bold">
          {notice}
        </div>
      )}

      {open && (
        <div className="fixed bottom-24 right-4 md:right-8 z-50 w-[calc(100vw-2rem)] max-h-[calc(100vh-7rem)] max-w-[480px] overflow-hidden rounded-[2rem] bg-white border border-gray-100 shadow-2xl">
          <div className="relative overflow-hidden bg-gray-950 text-white p-5">
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary/40 rounded-full blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-2xl">
                    🤖
                  </span>

                  <div>
                    <h3 className="font-bold text-lg">Asistent comenzi</h3>
                    <p className="text-white/60 text-xs">
                      Recomandări, coș, istoric și suport comandă
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="!w-9 !h-9 rounded-full border border-white/20 bg-white/10 text-white p-0 flex items-center justify-center"
                aria-label="Închide chatbot"
              >
                ×
              </button>
            </div>

            <div className="relative grid grid-cols-3 gap-2 mt-5">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                <p className="text-white/50 text-xs">Coș</p>
                <p className="font-bold">{cartCount} produse</p>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                <p className="text-white/50 text-xs">Total</p>
                <p className="font-bold">{formatMoney(cartTotal)}</p>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                <p className="text-white/50 text-xs">Mod</p>
                <p className="font-bold">Inteligent</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={sending}
                  className="!w-auto shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:border-primary hover:text-primary transition disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="scrollbar-thin h-[55vh] max-h-[440px] min-h-[320px] overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((message, index) => (
              <ChatMessage
                key={`${message.role}-${index}`}
                message={message}
                onAddProduct={handleAddProduct}
                onAddAllProducts={handleAddAllProducts}
              />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-3xl rounded-bl-md bg-gray-100 text-gray-600 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Se analizează cererea...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-gray-100 bg-white"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(ev) => setInput(ev.target.value)}
                placeholder="Ex: Nu am primit comanda, vreau contact..."
                className="!my-0 !rounded-full !bg-gray-50 !border-gray-200 !px-4"
              />

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="!w-auto bg-primary text-white border-0 rounded-full px-5 py-3 font-bold disabled:opacity-50"
              >
                Trimite
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3">
              <p className="text-xs text-gray-400">
                Pentru reclamații, chatbotul afișează datele de contact.
              </p>

              <button
                type="button"
                onClick={resetChat}
                className="!w-auto border-0 bg-transparent p-0 text-xs font-bold text-primary hover:underline"
              >
                Resetează
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-4 md:right-8 z-50 !w-16 !h-16 rounded-full border-0 bg-primary text-white shadow-2xl shadow-primary/30 flex items-center justify-center text-2xl hover:scale-105 transition"
        aria-label="Deschide asistentul de comenzi"
      >
        {open ? "×" : "🤖"}
      </button>
    </>
  );
}