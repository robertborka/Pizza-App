import mongoose from "mongoose";
import AIClient from "openai";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { MenuItem } from "@/app/models/menuItem";
import { Category } from "@/app/models/category";
import { Ingredient } from "@/app/models/ingredient";
import { Order } from "@/app/models/order";
import { User } from "@/app/models/user";
import { ChatbotLog } from "@/app/models/chatbotLog";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

export const dynamic = "force-dynamic";

const VALID_MESSAGE_ROLES = ["user", "assistant"];

const CONTACT_INFO = {
  restaurant: "Top Family Pizza",
  address: "Strada Rozelor 36B, Brașov, România",
  phone: "0760 530 530",
  email: "topfamilypizza@gmail.com",
};

const PRODUCT_INTENTS = [
  "complete_order",
  "budget_recommendation",
  "people_recommendation",
  "ingredient_filter",
  "cart_pairing",
  "spicy_recommendation",
  "vegetarian_recommendation",
  "sauce_recommendation",
  "drink_recommendation",
  "dessert_recommendation",
  "general_recommendation",
  "menu_recommendation",
];

const ORDER_INTENTS = ["order_status", "order_details", "order_problem"];

const ADMIN_INTENTS = ["admin_summary", "admin_dashboard", "admin_report"];

const CONTACT_INTENTS = ["contact_request", "complaint_request", "order_problem"];

const ALL_INTENTS = [
  ...PRODUCT_INTENTS,
  ...ORDER_INTENTS,
  ...ADMIN_INTENTS,
  "contact_request",
  "complaint_request",
  "general_chat",
];

async function connectToDatabase() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  await tryConnectToDatabase();
  return true;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isObjectIdLike(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function shortOrderId(orderId) {
  if (!orderId) {
    return "";
  }

  return `#${String(orderId).slice(-6).toUpperCase()}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(0)} lei`;
}

function getCategoryName(category) {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    if (isObjectIdLike(category)) {
      return "";
    }

    return category;
  }

  return category.name || "";
}

function getIngredientNames(ingredients) {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
    .map((ingredient) => {
      if (!ingredient) {
        return "";
      }

      if (typeof ingredient === "string") {
        if (isObjectIdLike(ingredient)) {
          return "";
        }

        return ingredient;
      }

      return ingredient.name || "";
    })
    .filter(Boolean);
}

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

function serializeMenuItem(item) {
  const categoryName = getCategoryName(item.category);
  const ingredientNames = getIngredientNames(item.ingredients);

  return {
    _id: String(item._id || ""),
    name: item.name || "",
    description: item.description || "",
    image: item.image || "/pizza.png",
    basePrice: Number(item.basePrice ?? item.price ?? 0),
    price: Number(item.price ?? item.basePrice ?? 0),
    category: categoryName,
    ingredients: ingredientNames,
  };
}

function serializeOrder(order) {
  if (!order) {
    return null;
  }

  return {
    _id: String(order._id),
    shortId: shortOrderId(order._id),
    status: order.status || "Nouă",
    totalPrice: Number(order.totalPrice || 0),
    paid: Boolean(order.paid),
    address: order.address || "",
    city: order.city || "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    products: Array.isArray(order.products)
      ? order.products.map((product) => ({
          name: product.name || "Produs",
          quantity: Number(product.quantity || 1),
          price: Number(product.basePrice ?? product.price ?? 0),
          category: getCategoryName(product.category),
        }))
      : [],
  };
}

async function getCurrentUser(req, databaseReady) {
  const token = await getToken({
    req,
    secret:
      process.env.NEXTAUTH_SECRET ||
      "top-family-pizza-development-secret-change-before-production",
  });

  if (!token?.email) {
    return null;
  }

  const email = normalizeEmail(token.email);
  const user = databaseReady ? await User.findOne({ email }).lean() : null;

  return {
    email,
    name: token.name || user?.name || "",
    admin: Boolean(user?.admin || token.admin),
  };
}

async function loadMenuItems(databaseReady) {
  if (!databaseReady) {
    return [];
  }

  void Category;
  void Ingredient;

  const items = await MenuItem.find({ available: { $ne: false } })
    .sort({ createdAt: -1 })
    .populate("category")
    .populate("ingredients")
    .lean();

  return items.map(serializeMenuItem).filter((item) => item.name);
}

async function loadUserOrders(email) {
  if (!email) {
    return [];
  }

  const orders = await Order.find({
    userEmail: normalizeEmail(email),
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return orders.map(serializeOrder).filter(Boolean);
}

async function loadAdminOrders(isAdmin) {
  if (!isAdmin) {
    return [];
  }

  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return orders.map(serializeOrder).filter(Boolean);
}

function getLastUserMessage(messages) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return cleanText(lastUserMessage?.content);
}

function compactConversation(messages) {
  return messages
    .filter(
      (message) =>
        VALID_MESSAGE_ROLES.includes(message.role) && cleanText(message.content)
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: cleanText(message.content).slice(0, 900),
    }));
}

function getConversationText(messages) {
  return normalizeText(
    messages
      .filter((message) => VALID_MESSAGE_ROLES.includes(message.role))
      .map((message) => message.content)
      .join(" ")
  );
}

function getCartSummary(cartProducts) {
  if (!Array.isArray(cartProducts) || cartProducts.length === 0) {
    return [];
  }

  const grouped = new Map();

  for (const product of cartProducts) {
    const id = String(product?._id || product?.id || product?.productId || "");

    if (!id) {
      continue;
    }

    if (!grouped.has(id)) {
      grouped.set(id, {
        _id: id,
        name: product.name || "Produs",
        category: getCategoryName(product.category),
        quantity: 0,
        price: getProductPrice(product),
      });
    }

    grouped.get(id).quantity += 1;
  }

  return Array.from(grouped.values());
}

function getOrderHistoryInsights(userOrders) {
  const productMap = new Map();
  const categoryMap = new Map();

  for (const order of userOrders) {
    for (const product of order.products || []) {
      const name = product.name || "Produs";
      const category = product.category || "";

      if (!productMap.has(name)) {
        productMap.set(name, {
          name,
          quantity: 0,
        });
      }

      productMap.get(name).quantity += Number(product.quantity || 1);

      if (category) {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            name: category,
            quantity: 0,
          });
        }

        categoryMap.get(category).quantity += Number(product.quantity || 1);
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const lastOrder = userOrders[0] || null;

  const insights = [];

  if (topProducts[0]) {
    insights.push(`Ai comandat frecvent ${topProducts[0].name}.`);
  }

  if (topCategories[0]) {
    insights.push(`Categoria preferată pare să fie ${topCategories[0].name}.`);
  }

  return {
    topProducts,
    topCategories,
    lastOrder,
    insights,
  };
}

function getAdminSnapshot(adminOrders) {
  if (!Array.isArray(adminOrders) || adminOrders.length === 0) {
    return null;
  }

  const statusCounts = {};
  const productMap = new Map();

  let totalRevenue = 0;
  let activeOrders = 0;
  let cancelledOrders = 0;

  for (const order of adminOrders) {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

    if (order.status !== "Anulată") {
      totalRevenue += Number(order.totalPrice || 0);
    }

    if (order.status !== "Livrată" && order.status !== "Anulată") {
      activeOrders += 1;
    }

    if (order.status === "Anulată") {
      cancelledOrders += 1;
    }

    for (const product of order.products || []) {
      const name = product.name || "Produs";

      if (!productMap.has(name)) {
        productMap.set(name, {
          name,
          quantity: 0,
          revenue: 0,
        });
      }

      const productStats = productMap.get(name);
      productStats.quantity += Number(product.quantity || 1);
      productStats.revenue +=
        Number(product.quantity || 1) * Number(product.price || 0);
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    totalOrders: adminOrders.length,
    totalRevenue,
    activeOrders,
    cancelledOrders,
    statusCounts,
    topProducts,
  };
}

function productSearchArea(product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.category,
      Array.isArray(product.ingredients) ? product.ingredients.join(" ") : "",
    ].join(" ")
  );
}

function productMatches(product, keyword) {
  return productSearchArea(product).includes(normalizeText(keyword));
}

function findProductsByCategory(menuItems, categoryKeyword, limit = 3) {
  return menuItems
    .filter((item) => productMatches(item, categoryKeyword))
    .slice(0, limit);
}

function findProductsWithoutIngredient(menuItems, excludedWord, limit = 3) {
  const excluded = normalizeText(excludedWord);

  if (!excluded) {
    return [];
  }

  return menuItems
    .filter((item) => {
      const text = productSearchArea(item);

      return (
        !text.includes(excluded) && normalizeText(item.category).includes("pizza")
      );
    })
    .slice(0, limit);
}

function findProductsByBudget(menuItems, budget, limit = 4) {
  return menuItems
    .filter((item) => getProductPrice(item) <= budget)
    .sort((a, b) => getProductPrice(b) - getProductPrice(a))
    .slice(0, limit);
}

function findBestPizza(menuItems, preference) {
  const normalizedPreference = normalizeText(preference);

  let candidates = menuItems.filter((item) =>
    normalizeText(item.category).includes("pizza")
  );

  if (normalizedPreference.includes("picant")) {
    candidates = candidates.filter((item) => productMatches(item, "picant"));
  }

  if (
    normalizedPreference.includes("vegetarian") ||
    normalizedPreference.includes("fara carne")
  ) {
    candidates = candidates.filter((item) => productMatches(item, "vegetarian"));
  }

  if (normalizedPreference.includes("premium")) {
    candidates = candidates.filter((item) => productMatches(item, "premium"));
  }

  return candidates[0] || menuItems.find((item) => productMatches(item, "pizza"));
}

function findCheapestByKeyword(menuItems, keyword) {
  return menuItems
    .filter((item) => productMatches(item, keyword))
    .sort((a, b) => getProductPrice(a) - getProductPrice(b))[0];
}

function buildCompleteOrder(menuItems, userMessage, budget = null) {
  const selected = [];

  const pizza = findBestPizza(menuItems, userMessage);

  if (pizza) {
    selected.push(pizza);
  }

  const sauce = findCheapestByKeyword(menuItems, "sos");
  const drink = findCheapestByKeyword(menuItems, "baut");
  const dessert = findCheapestByKeyword(menuItems, "desert");

  for (const candidate of [sauce, drink, dessert]) {
    if (!candidate) {
      continue;
    }

    const alreadySelected = selected.some((item) => item._id === candidate._id);

    if (alreadySelected) {
      continue;
    }

    const nextTotal =
      selected.reduce((sum, item) => sum + getProductPrice(item), 0) +
      getProductPrice(candidate);

    if (budget && nextTotal > budget) {
      continue;
    }

    selected.push(candidate);
  }

  return selected.slice(0, 4);
}

function parseBudget(userMessage) {
  const normalized = normalizeText(userMessage);
  const match =
    normalized.match(/(?:sub|pana la|maxim|maximum|buget de|buget)\s*(\d+)/) ||
    normalized.match(/(\d+)\s*(?:lei|ron)/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parsePeopleCount(userMessage) {
  const normalized = normalizeText(userMessage);
  const match =
    normalized.match(/suntem\s*(\d+)/) ||
    normalized.match(/pentru\s*(\d+)\s*(?:persoane|pers|oameni)/) ||
    normalized.match(/(\d+)\s*(?:persoane|pers|oameni)/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseExcludedIngredient(userMessage) {
  const normalized = normalizeText(userMessage);

  const patterns = [
    /fara\s+([a-zăâîșț0-9 -]+)/i,
    /nu vreau\s+([a-zăâîșț0-9 -]+)/i,
    /sa nu aiba\s+([a-zăâîșț0-9 -]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return cleanText(match[1])
        .replace(/[?.!,]/g, "")
        .split(" ")
        .slice(0, 2)
        .join(" ");
    }
  }

  return "";
}

function getCartComplementProducts(menuItems, cartProducts) {
  const cartSummary = getCartSummary(cartProducts);

  if (!Array.isArray(cartSummary) || cartSummary.length === 0) {
    return [];
  }

  const cartText = normalizeText(
    cartSummary.map((item) => `${item.name} ${item.category}`).join(" ")
  );

  if (cartText.includes("desert") && !cartText.includes("baut")) {
    return findProductsByCategory(menuItems, "baut", 3);
  }

  if (cartText.includes("pizza")) {
    const sauce = findCheapestByKeyword(menuItems, "sos");
    const drink = findCheapestByKeyword(menuItems, "baut");
    const dessert = findCheapestByKeyword(menuItems, "desert");

    return [sauce, drink, dessert].filter(Boolean).slice(0, 3);
  }

  return [];
}

function findSuggestedProductsByNames(productNames, menuItems) {
  if (!Array.isArray(productNames)) {
    return [];
  }

  const selected = [];

  for (const rawName of productNames) {
    const wantedName = normalizeText(rawName);

    if (!wantedName) {
      continue;
    }

    const exact = menuItems.find(
      (item) => normalizeText(item.name) === wantedName
    );

    const partial =
      exact ||
      menuItems.find((item) => normalizeText(item.name).includes(wantedName)) ||
      menuItems.find((item) => wantedName.includes(normalizeText(item.name)));

    if (partial && !selected.some((item) => item._id === partial._id)) {
      selected.push(partial);
    }
  }

  return selected.slice(0, 5);
}

function inferIntentFromText({ userMessage, messages, isAdmin }) {
  const normalized = normalizeText(userMessage);
  const conversationText = getConversationText(messages);

  if (
    normalized.includes("numar") ||
    normalized.includes("telefon") ||
    normalized.includes("contact") ||
    normalized.includes("email") ||
    normalized.includes("adresa restaurant") ||
    normalized.includes("cum va contactez")
  ) {
    return "contact_request";
  }

  if (
    normalized.includes("reclamatie") ||
    normalized.includes("reclamație") ||
    normalized.includes("plangere") ||
    normalized.includes("plângere") ||
    normalized.includes("sesizare") ||
    normalized.includes("vreau sa depun")
  ) {
    return "complaint_request";
  }

  if (
    normalized.includes("nu am primit") ||
    normalized.includes("n am primit") ||
    normalized.includes("n-a venit") ||
    normalized.includes("nu a venit") ||
    normalized.includes("nu a ajuns") ||
    normalized.includes("n-a ajuns") ||
    normalized.includes("adresa este corecta") ||
    normalized.includes("adresa e corecta") ||
    conversationText.includes("nu am primit comanda")
  ) {
    return "order_problem";
  }

  if (
    normalized.includes("status") ||
    normalized.includes("ultima mea comanda") ||
    normalized.includes("ultima comanda") ||
    normalized.includes("descrie ultima") ||
    normalized.includes("unde e comanda") ||
    normalized.includes("comanda mea")
  ) {
    return "order_status";
  }

  if (
    isAdmin &&
    (normalized.includes("admin") ||
      normalized.includes("dashboard") ||
      normalized.includes("vanzari") ||
      normalized.includes("vânzări") ||
      normalized.includes("comenzi azi") ||
      normalized.includes("cum merg comenzile") ||
      normalized.includes("cum merge"))
  ) {
    return "admin_summary";
  }

  if (
    normalized.includes("comanda completa") ||
    normalized.includes("meniu complet") ||
    normalized.includes("recomanda-mi o comanda") ||
    normalized.includes("alege tu")
  ) {
    return "complete_order";
  }

  if (parseBudget(userMessage)) {
    return "budget_recommendation";
  }

  if (parsePeopleCount(userMessage)) {
    return "people_recommendation";
  }

  if (parseExcludedIngredient(userMessage)) {
    return "ingredient_filter";
  }

  if (normalized.includes("cos") || normalized.includes("ce merge cu")) {
    return "cart_pairing";
  }

  if (normalized.includes("picant") || normalized.includes("iute")) {
    return "spicy_recommendation";
  }

  if (
    normalized.includes("vegetarian") ||
    normalized.includes("fara carne") ||
    normalized.includes("legume")
  ) {
    return "vegetarian_recommendation";
  }

  if (normalized.includes("sos")) {
    return "sauce_recommendation";
  }

  if (
    normalized.includes("bautura") ||
    normalized.includes("băutură") ||
    normalized.includes("bauturi") ||
    normalized.includes("băuturi") ||
    normalized.includes("suc") ||
    normalized.includes("apa") ||
    normalized.includes("apă")
  ) {
    return "drink_recommendation";
  }

  if (
    normalized.includes("desert") ||
    normalized.includes("dulce") ||
    normalized.includes("clatite") ||
    normalized.includes("clătite") ||
    normalized.includes("papanasi") ||
    normalized.includes("papanași")
  ) {
    return "dessert_recommendation";
  }

  return "general_chat";
}

function isProductIntent(intent) {
  return PRODUCT_INTENTS.includes(intent);
}

function isOrderIntent(intent) {
  return ORDER_INTENTS.includes(intent);
}

function isAdminIntent(intent) {
  return ADMIN_INTENTS.includes(intent);
}

function isContactIntent(intent) {
  return CONTACT_INTENTS.includes(intent);
}

function buildUiRules({ intent, isAdmin }) {
  return {
    showProducts: isProductIntent(intent),
    showLastOrder: isOrderIntent(intent),
    showAdminSnapshot: Boolean(isAdmin && isAdminIntent(intent)),
    showInsights: isProductIntent(intent),
    showContact: isContactIntent(intent),
  };
}

function buildFallbackReply({
  userMessage,
  messages,
  menuItems,
  cartProducts,
  userContext,
  adminSnapshot,
  isAdmin,
}) {
  const inferredIntent = inferIntentFromText({
    userMessage,
    messages,
    isAdmin,
  });

  const budget = parseBudget(userMessage);
  const peopleCount = parsePeopleCount(userMessage);
  const excludedIngredient = parseExcludedIngredient(userMessage);

  if (inferredIntent === "contact_request") {
    return {
      message: `Poți contacta restaurantul ${CONTACT_INFO.restaurant} la telefon ${CONTACT_INFO.phone} sau pe email la ${CONTACT_INFO.email}. Adresa restaurantului este ${CONTACT_INFO.address}.`,
      suggestedProducts: [],
      intent: "contact_request",
      actionLabel: "",
      lastOrder: null,
      adminSnapshot: null,
      insights: [],
      contactInfo: CONTACT_INFO,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "complaint_request") {
    return {
      message: `Pentru reclamații sau sesizări, contactează direct restaurantul la ${CONTACT_INFO.phone} sau prin email la ${CONTACT_INFO.email}. Include numărul comenzii și descrierea problemei.`,
      suggestedProducts: [],
      intent: "complaint_request",
      actionLabel: "",
      lastOrder: null,
      adminSnapshot: null,
      insights: [],
      contactInfo: CONTACT_INFO,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "order_problem") {
    const lastOrder = userContext?.lastOrder;

    return {
      message: lastOrder
        ? `Îmi pare rău pentru problemă. Ultima ta comandă este ${lastOrder.shortId}, cu statusul „${lastOrder.status}”. Pentru verificarea livrării sau depunerea unei reclamații, contactează restaurantul la ${CONTACT_INFO.phone} sau prin email la ${CONTACT_INFO.email}.`
        : `Îmi pare rău pentru problemă. Nu am găsit o comandă recentă în contul tău. Pentru reclamații, contactează restaurantul la ${CONTACT_INFO.phone} sau prin email la ${CONTACT_INFO.email}.`,
      suggestedProducts: [],
      intent: "order_problem",
      actionLabel: "Vezi comenzile mele",
      lastOrder: lastOrder || null,
      adminSnapshot: null,
      insights: [],
      contactInfo: CONTACT_INFO,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "order_status") {
    const lastOrder = userContext?.lastOrder;

    if (!lastOrder) {
      return {
        message:
          "Nu am găsit comenzi anterioare pentru contul tău. După ce plasezi o comandă, statusul va apărea în pagina „Comenzile mele”.",
        suggestedProducts: [],
        intent: "order_status",
        actionLabel: "",
        lastOrder: null,
        adminSnapshot: null,
        insights: [],
        contactInfo: null,
        aiUsed: false,
        source: "Reguli interne",
      };
    }

    return {
      message: `Ultima ta comandă este ${lastOrder.shortId}, are statusul „${lastOrder.status}” și totalul de ${formatMoney(lastOrder.totalPrice)}.`,
      suggestedProducts: [],
      intent: "order_status",
      actionLabel: "Vezi comenzile mele",
      lastOrder,
      adminSnapshot: null,
      insights: [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "admin_summary") {
    if (!adminSnapshot) {
      return {
        message:
          "Nu am suficiente date administrative pentru analiză. După ce există comenzi, pot rezuma vânzările, comenzile active și top produsele.",
        suggestedProducts: [],
        intent: "admin_summary",
        adminSnapshot: null,
        lastOrder: null,
        insights: [],
        contactInfo: null,
        aiUsed: false,
        source: "Reguli interne",
      };
    }

    const topProduct = adminSnapshot.topProducts?.[0];

    return {
      message: `Administrativ, ai ${adminSnapshot.totalOrders} comenzi analizate, valoare totală de ${formatMoney(
        adminSnapshot.totalRevenue
      )}, ${adminSnapshot.activeOrders} comenzi active și ${
        adminSnapshot.cancelledOrders
      } comenzi anulate.${
        topProduct
          ? ` Cel mai vândut produs este ${topProduct.name}, cu ${topProduct.quantity} bucăți.`
          : ""
      }`,
      suggestedProducts: [],
      intent: "admin_summary",
      adminSnapshot,
      lastOrder: null,
      insights: [],
      contactInfo: null,
      actionLabel: "Deschide dashboard",
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "complete_order") {
    const products = buildCompleteOrder(menuItems, userMessage, budget);

    return {
      message:
        products.length > 0
          ? `Ți-am pregătit o comandă completă: ${products
              .map((product) => product.name)
              .join(", ")}.`
          : "Nu am găsit suficiente produse pentru o comandă completă.",
      suggestedProducts: products,
      intent: "complete_order",
      actionLabel: "Adaugă toate recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (budget) {
    const products = findProductsByBudget(menuItems, budget, 4);

    return {
      message:
        products.length > 0
          ? `Pentru un buget de aproximativ ${formatMoney(budget)}, îți recomand aceste produse.`
          : `Nu am găsit produse care să se încadreze clar în bugetul de ${formatMoney(budget)}.`,
      suggestedProducts: products,
      intent: "budget_recommendation",
      actionLabel: "Adaugă recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (peopleCount) {
    const pizzaCount = Math.max(1, Math.ceil(peopleCount * 0.75));
    const pizzas = menuItems
      .filter((item) => normalizeText(item.category).includes("pizza"))
      .slice(0, pizzaCount);

    const sauce = findCheapestByKeyword(menuItems, "sos");
    const drink = findCheapestByKeyword(menuItems, "baut");

    const products = [...pizzas, sauce, drink].filter(Boolean).slice(0, 5);

    return {
      message: `Pentru ${peopleCount} persoane, aș recomanda aproximativ ${pizzaCount} pizza, plus un sos și o băutură.`,
      suggestedProducts: products,
      intent: "people_recommendation",
      actionLabel: "Adaugă recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (excludedIngredient) {
    const products = findProductsWithoutIngredient(
      menuItems,
      excludedIngredient,
      4
    );

    return {
      message:
        products.length > 0
          ? `Am filtrat produse care nu par să conțină „${excludedIngredient}”. Verifică ingredientele înainte de comandă.`
          : `Nu am găsit produse clare fără „${excludedIngredient}”.`,
      suggestedProducts: products,
      intent: "ingredient_filter",
      actionLabel: "Adaugă recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "cart_pairing") {
    const products = getCartComplementProducts(menuItems, cartProducts);

    return {
      message:
        products.length > 0
          ? "Pe baza coșului tău, aș adăuga ceva complementar: un sos, o băutură sau un desert potrivit."
          : "Coșul este gol. Adaugă mai întâi un produs, apoi pot recomanda ceva care se potrivește cu selecția ta.",
      suggestedProducts: products,
      intent: "cart_pairing",
      actionLabel: products.length > 0 ? "Adaugă recomandările" : "",
      lastOrder: null,
      adminSnapshot: null,
      insights: products.length > 0 ? userContext?.insights || [] : [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "spicy_recommendation") {
    return {
      message:
        "Pentru ceva picant, ți-am selectat câteva opțiuni potrivite din meniu.",
      suggestedProducts: findProductsByCategory(menuItems, "picant", 4),
      intent: "spicy_recommendation",
      actionLabel: "Adaugă recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "vegetarian_recommendation") {
    return {
      message:
        "Pentru o variantă fără carne, ți-am selectat produse vegetariene din meniu.",
      suggestedProducts: findProductsByCategory(menuItems, "vegetarian", 4),
      intent: "vegetarian_recommendation",
      actionLabel: "Adaugă recomandările",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "sauce_recommendation") {
    return {
      message: "Am găsit câteva sosuri potrivite pentru comandă.",
      suggestedProducts: findProductsByCategory(menuItems, "sos", 4),
      intent: "sauce_recommendation",
      actionLabel: "Adaugă sosurile",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "drink_recommendation") {
    return {
      message: "Am găsit câteva băuturi potrivite pentru comandă.",
      suggestedProducts: findProductsByCategory(menuItems, "baut", 4),
      intent: "drink_recommendation",
      actionLabel: "Adaugă băuturile",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  if (inferredIntent === "dessert_recommendation") {
    return {
      message: "Pentru ceva dulce, ți-am selectat câteva deserturi din meniu.",
      suggestedProducts: findProductsByCategory(menuItems, "desert", 4),
      intent: "dessert_recommendation",
      actionLabel: "Adaugă deserturile",
      lastOrder: null,
      adminSnapshot: null,
      insights: userContext?.insights || [],
      contactInfo: null,
      aiUsed: false,
      source: "Reguli interne",
    };
  }

  return {
    message:
      "Pot să te ajut cu recomandări din meniu, comandă completă, produse pentru bugetul tău, date de contact sau statusul ultimei comenzi.",
    suggestedProducts: [],
    intent: "general_chat",
    actionLabel: "",
    lastOrder: null,
    adminSnapshot: null,
    insights: [],
    contactInfo: null,
    aiUsed: false,
    source: "Reguli interne",
  };
}

function buildMenuContext(menuItems) {
  return menuItems.slice(0, 90).map((item) => ({
    name: item.name,
    category: item.category,
    price: item.basePrice,
    description: item.description,
    ingredients: item.ingredients,
  }));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  const direct = safeJsonParse(cleanText(text));

  if (direct) {
    return direct;
  }

  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return safeJsonParse(text.slice(startIndex, endIndex + 1));
}

function sanitizeIntent(rawIntent, inferredIntent) {
  const forcedIntents = [
    "contact_request",
    "complaint_request",
    "order_problem",
  ];

  if (forcedIntents.includes(inferredIntent)) {
    return inferredIntent;
  }

  const intent = cleanText(rawIntent);

  if (!intent) {
    return inferredIntent;
  }

  if (!ALL_INTENTS.includes(intent)) {
    return inferredIntent;
  }

  return intent;
}

async function generateAiReply({
  messages,
  userMessage,
  menuItems,
  cartProducts,
  userContext,
  adminSnapshot,
  isAdmin,
}) {
  const inferredIntent = inferIntentFromText({
    userMessage,
    messages,
    isAdmin,
  });

  const fallback = buildFallbackReply({
    userMessage,
    messages,
    menuItems,
    cartProducts,
    userContext,
    adminSnapshot,
    isAdmin,
  });

  if (
    inferredIntent === "cart_pairing" &&
    getCartSummary(cartProducts).length === 0
  ) {
    return fallback;
  }

  const aiApiKey = process.env.AI_PROVIDER_API_KEY;

  if (!aiApiKey) {
    return fallback;
  }

  try {
    const client = new AIClient({
      apiKey: aiApiKey,
    });

    const model =
      process.env.AI_CHATBOT_MODEL || "gpt-4.1-mini";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Ești chatbotul premium Top Family Pizza. Răspunzi în română, clar și util. Recomanzi doar produse existente în MENU_CONTEXT. Nu inventa produse, prețuri sau ingrediente. Pentru reclamații, probleme de livrare sau cereri de contact, folosește CONTACT_CONTEXT. Nu spune că ai transmis problema către echipă dacă sistemul nu are această funcție. Răspunde DOAR cu JSON valid în forma: {\"reply\":\"text\",\"suggestedProductNames\":[\"produs\"],\"intent\":\"string\",\"actionLabel\":\"string\"}. Intenturi valide: complete_order, budget_recommendation, people_recommendation, ingredient_filter, cart_pairing, spicy_recommendation, vegetarian_recommendation, sauce_recommendation, drink_recommendation, dessert_recommendation, general_recommendation, order_status, order_details, order_problem, admin_summary, admin_dashboard, admin_report, contact_request, complaint_request, general_chat.",
        },
        {
          role: "user",
          content: JSON.stringify({
            MENU_CONTEXT: buildMenuContext(menuItems),
            CART_CONTEXT: getCartSummary(cartProducts),
            USER_CONTEXT: userContext,
            ADMIN_CONTEXT: isAdmin ? adminSnapshot : null,
            CONTACT_CONTEXT: CONTACT_INFO,
            IS_ADMIN: Boolean(isAdmin),
            INFERRED_INTENT: inferredIntent,
            CONVERSATION: compactConversation(messages),
          }),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);

    if (!parsed?.reply) {
      return fallback;
    }

    const finalIntent = sanitizeIntent(parsed.intent, inferredIntent);
    const uiRules = buildUiRules({
      intent: finalIntent,
      isAdmin,
    });

    let suggestedProducts = [];

    if (uiRules.showProducts) {
      suggestedProducts = findSuggestedProductsByNames(
        parsed.suggestedProductNames,
        menuItems
      );

      if (
        suggestedProducts.length === 0 &&
        fallback.suggestedProducts?.length > 0
      ) {
        suggestedProducts = fallback.suggestedProducts;
      }
    }

    return {
      message: cleanText(parsed.reply),
      suggestedProducts,
      intent: finalIntent,
      actionLabel: cleanText(parsed.actionLabel) || fallback.actionLabel || "",
      lastOrder: uiRules.showLastOrder
        ? fallback.lastOrder || userContext?.lastOrder || null
        : null,
      adminSnapshot: uiRules.showAdminSnapshot ? adminSnapshot : null,
      insights: uiRules.showInsights ? userContext?.insights || [] : [],
      contactInfo: uiRules.showContact ? CONTACT_INFO : null,
      aiUsed: true,
      source: "Motor inteligent",
      ui: uiRules,
    };
  } catch (error) {
    console.error("AI CHATBOT FALLBACK:", error);
    return fallback;
  }
}

async function saveChatbotLog({
  currentUser,
  userMessage,
  response,
  cartProducts,
}) {
  try {
    await ChatbotLog.create({
      userEmail: currentUser?.email || "",
      userName: currentUser?.name || "",
      isAdmin: Boolean(currentUser?.admin),
      userMessage,
      assistantReply: response.message || "",
      intent: response.intent || "",
      aiUsed: Boolean(response.aiUsed),
      source: response.source || "",
      suggestedProducts: Array.isArray(response.suggestedProducts)
        ? response.suggestedProducts.map((product) => ({
            _id: product._id,
            name: product.name,
            price: product.basePrice,
          }))
        : [],
      cartProductsCount: Array.isArray(cartProducts) ? cartProducts.length : 0,
    });
  } catch (error) {
    console.error("CHATBOT LOG ERROR:", error);
  }
}

export async function POST(req) {
  try {
    const databaseReady = await connectToDatabase();

    const currentUser = await getCurrentUser(req, databaseReady);
    const body = await req.json();

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const cartProducts = Array.isArray(body.cartProducts)
      ? body.cartProducts
      : [];

    const userMessage = getLastUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json(
        {
          error: "Mesajul este gol.",
        },
        { status: 400 }
      );
    }

    const [menuItems, userOrders, adminOrders] = await Promise.all([
      loadMenuItems(databaseReady),
      databaseReady ? loadUserOrders(currentUser?.email) : [],
      databaseReady ? loadAdminOrders(Boolean(currentUser?.admin)) : [],
    ]);

    const orderInsights = getOrderHistoryInsights(userOrders);
    const adminSnapshot = getAdminSnapshot(adminOrders);

    const userContext = {
      isAuthenticated: Boolean(currentUser?.email),
      email: currentUser?.email || "",
      name: currentUser?.name || "",
      isAdmin: Boolean(currentUser?.admin),
      topProducts: orderInsights.topProducts,
      topCategories: orderInsights.topCategories,
      lastOrder: orderInsights.lastOrder,
      insights: orderInsights.insights,
      ordersCount: userOrders.length,
    };

    const response = await generateAiReply({
      messages,
      userMessage,
      menuItems,
      cartProducts,
      userContext,
      adminSnapshot,
      isAdmin: Boolean(currentUser?.admin),
    });

    const uiRules =
      response.ui ||
      buildUiRules({
        intent: response.intent || "general_chat",
        isAdmin: Boolean(currentUser?.admin),
      });

    const finalResponse = {
      message: response.message,
      suggestedProducts: uiRules.showProducts
        ? response.suggestedProducts || []
        : [],
      aiUsed: Boolean(response.aiUsed),
      source: response.source || "Reguli interne",
      intent: response.intent || "general_chat",
      actionLabel: uiRules.showProducts ? response.actionLabel || "" : "",
      insights: uiRules.showInsights ? response.insights || [] : [],
      lastOrder: uiRules.showLastOrder
        ? response.lastOrder || userContext.lastOrder || null
        : null,
      adminSnapshot: uiRules.showAdminSnapshot
        ? response.adminSnapshot || adminSnapshot || null
        : null,
      contactInfo: uiRules.showContact
        ? response.contactInfo || CONTACT_INFO
        : null,
      ui: uiRules,
      quickPrompts: [
        "Recomandă-mi o comandă completă",
        "Ce merge cu ce am în coș?",
        "Vreau ceva sub 50 lei",
        "Suntem 3 persoane, ce recomanzi?",
        "Unde e ultima mea comandă?",
        "Vreau număr de contact",
        currentUser?.admin ? "Cum merg comenzile azi?" : "",
      ].filter(Boolean),
    };

    if (databaseReady) {
      await saveChatbotLog({
        currentUser,
        userMessage,
        response: finalResponse,
        cartProducts,
      });
    }

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("AI CHATBOT ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la chatbot.",
      },
      { status: 500 }
    );
  }
}