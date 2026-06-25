import mongoose from "mongoose";
import AIClient from "openai";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Order } from "@/app/models/order";
import { User } from "@/app/models/user";
import { MenuItem } from "@/app/models/menuItem";
import { Category } from "@/app/models/category";

export const dynamic = "force-dynamic";

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI;

  if (!mongoUrl) {
    throw new Error("Serviciul intern nu este disponibil momentan.");
  }

  await mongoose.connect(mongoUrl);
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isObjectIdLike(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

async function getCurrentUser(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.email) {
    return null;
  }

  const email = normalizeEmail(token.email);
  const user = await User.findOne({ email }).lean();

  return {
    email,
    admin: Boolean(user?.admin),
  };
}

function getOrderProductId(product) {
  return String(product?.productId || product?._id || product?.id || "");
}

function getCategoryNameFromValue(category) {
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

function getCategoryName(product, menuItemsById) {
  const directCategoryName = getCategoryNameFromValue(product?.category);

  if (directCategoryName) {
    return directCategoryName;
  }

  const productId = getOrderProductId(product);

  if (productId && menuItemsById.has(productId)) {
    const menuItem = menuItemsById.get(productId);
    const menuCategoryName = getCategoryNameFromValue(menuItem.category);

    if (menuCategoryName) {
      return menuCategoryName;
    }
  }

  return "Fără categorie";
}

function collectProductIdsFromOrders(orders) {
  const productIds = new Set();

  for (const order of orders) {
    const products = Array.isArray(order.products) ? order.products : [];

    for (const product of products) {
      const productId = getOrderProductId(product);

      if (productId && isObjectIdLike(productId)) {
        productIds.add(productId);
      }
    }
  }

  return Array.from(productIds);
}

async function buildMenuItemsById(orders) {
  const productIds = collectProductIdsFromOrders(orders);

  if (productIds.length === 0) {
    return new Map();
  }

  void Category;

  const menuItems = await MenuItem.find({
    _id: {
      $in: productIds,
    },
  })
    .populate("category")
    .lean();

  return new Map(menuItems.map((item) => [String(item._id), item]));
}

function buildStatsForReport(orders, menuItemsById) {
  const statusCounts = {};
  const productMap = new Map();
  const categoryMap = new Map();

  let totalRevenue = 0;
  let activeOrders = 0;
  let unpaidOrders = 0;
  let cancelledOrders = 0;

  for (const order of orders) {
    const status = order.status || "Nouă";
    const totalPrice = Number(order.totalPrice || 0);

    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (status !== "Anulată") {
      totalRevenue += totalPrice;
    }

    if (status !== "Livrată" && status !== "Anulată") {
      activeOrders += 1;
    }

    if (!order.paid) {
      unpaidOrders += 1;
    }

    if (status === "Anulată") {
      cancelledOrders += 1;
    }

    const products = Array.isArray(order.products) ? order.products : [];

    for (const product of products) {
      const name = product.name || "Produs";
      const quantity = Number(product.quantity || 1);
      const price = Number(product.basePrice ?? product.price ?? 0);
      const categoryName = getCategoryName(product, menuItemsById);

      if (!productMap.has(name)) {
        productMap.set(name, {
          name,
          quantity: 0,
          revenue: 0,
          category: categoryName,
        });
      }

      const productStats = productMap.get(name);
      productStats.quantity += quantity;
      productStats.revenue += quantity * price;

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          name: categoryName,
          quantity: 0,
          revenue: 0,
        });
      }

      const categoryStats = categoryMap.get(categoryName);
      categoryStats.quantity += quantity;
      categoryStats.revenue += quantity * price;
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const weakProducts = Array.from(productMap.values())
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 6);

  const categories = Array.from(categoryMap.values()).sort(
    (a, b) => b.quantity - a.quantity
  );

  const averageOrderValue =
    orders.length > 0
      ? Math.round((totalRevenue / orders.length) * 100) / 100
      : 0;

  return {
    totalOrders: orders.length,
    totalRevenue,
    averageOrderValue,
    activeOrders,
    unpaidOrders,
    cancelledOrders,
    statusCounts,
    topProducts,
    weakProducts,
    categories,
  };
}

function buildFallbackReport(stats) {
  const topProduct = stats.topProducts?.[0];
  const topCategory = stats.categories?.[0];

  const observations = [];

  if (topProduct) {
    observations.push(
      `Cel mai vândut produs este ${topProduct.name}, cu ${topProduct.quantity} bucăți comandate.`
    );
  }

  if (topCategory) {
    observations.push(
      `Categoria cu cea mai bună performanță este ${topCategory.name}, cu ${topCategory.quantity} produse vândute.`
    );
  }

  if (stats.activeOrders > 0) {
    observations.push(
      `Există ${stats.activeOrders} comenzi active care trebuie monitorizate.`
    );
  }

  if (stats.unpaidOrders > 0) {
    observations.push(
      `Există ${stats.unpaidOrders} comenzi marcate ca neachitate.`
    );
  }

  return {
    aiUsed: false,
    source: "Reguli interne",
    summary:
      stats.totalOrders > 0
        ? `Au fost analizate ${stats.totalOrders} comenzi, cu încasări totale de ${stats.totalRevenue} lei și o valoare medie de ${stats.averageOrderValue} lei pe comandă.`
        : "Nu există suficiente comenzi pentru o analiză detaliată.",
    observations:
      observations.length > 0
        ? observations
        : ["Nu există încă suficiente date pentru observații comerciale clare."],
    recommendations: [
      "Promovează produsele cele mai vândute în zona superioară a meniului.",
      "Urmărește comenzile active pentru a reduce timpul de pregătire și livrare.",
      "Verifică produsele cu vânzări scăzute și îmbunătățește imaginea, descrierea sau poziționarea lor.",
      "Folosește recomandările AI din coș pentru a crește valoarea medie a comenzilor.",
    ],
    risks:
      stats.cancelledOrders > 0
        ? [`Au fost identificate ${stats.cancelledOrders} comenzi anulate.`]
        : [
            "Nu au fost detectate riscuri operaționale majore pe baza datelor actuale.",
          ],
    productsToPromote: stats.topProducts
      .slice(0, 3)
      .map((product) => product.name),
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function generateAiReport(stats) {
  const aiApiKey = process.env.AI_PROVIDER_API_KEY;

  if (!aiApiKey) {
    return buildFallbackReport(stats);
  }

  try {
    const client = new AIClient({
      apiKey: aiApiKey,
    });

    const model =
      process.env.AI_ADMIN_REPORT_MODEL ||
      
      "gpt-4.1-mini";

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Ești un asistent AI pentru administrarea unei pizzerii. Răspunde doar cu JSON valid în limba română.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Analizează comenzile și generează raport admin.",
            shape: {
              summary: "string",
              observations: ["string"],
              recommendations: ["string"],
              risks: ["string"],
              productsToPromote: ["string"],
            },
            stats,
          }),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(content);

    if (!parsed) {
      return buildFallbackReport(stats);
    }

    return {
      aiUsed: true,
      source: "Motor inteligent",
      summary: cleanText(parsed.summary),
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.map(cleanText).filter(Boolean)
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(cleanText).filter(Boolean)
        : [],
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.map(cleanText).filter(Boolean)
        : [],
      productsToPromote: Array.isArray(parsed.productsToPromote)
        ? parsed.productsToPromote.map(cleanText).filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error("AI ADMIN REPORT ERROR:", error);
    return buildFallbackReport(stats);
  }
}

export async function GET(req) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);

    if (!currentUser?.admin) {
      return NextResponse.json(
        {
          error: "Nu ai drepturi pentru generarea raportului AI.",
        },
        { status: 403 }
      );
    }

    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    const menuItemsById = await buildMenuItemsById(orders);
    const stats = buildStatsForReport(orders, menuItemsById);
    const report = await generateAiReport(stats);

    return NextResponse.json({
      report,
      stats,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error("ADMIN AI REPORT ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la generarea raportului AI.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  return GET(req);
}