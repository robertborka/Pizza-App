import mongoose from "mongoose";
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

function getStartOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDayLabel(date) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getLastSevenDays() {
  const today = getStartOfDay(new Date());
  const days = [];

  for (let index = 6; index >= 0; index--) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    days.push({
      iso: getIsoDate(date),
      label: getDayLabel(date),
      orders: 0,
      revenue: 0,
    });
  }

  return days;
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

function buildDashboardStats(orders, menuItemsById) {
  const statusCounts = {
    Nouă: 0,
    "În pregătire": 0,
    "Pe drum": 0,
    Livrată: 0,
    Anulată: 0,
  };

  const last7Days = getLastSevenDays();
  const last7DaysMap = new Map(last7Days.map((day) => [day.iso, day]));

  const today = getStartOfDay(new Date());
  const productMap = new Map();
  const categoryMap = new Map();
  const customerEmails = new Set();

  let totalRevenue = 0;
  let todayRevenue = 0;
  let todayOrders = 0;
  let activeOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let paidOrders = 0;
  let unpaidOrders = 0;
  let totalProductsSold = 0;

  for (const order of orders) {
    const status = order.status || "Nouă";
    const totalPrice = Number(order.totalPrice || 0);
    const createdAt = order.createdAt ? new Date(order.createdAt) : null;

    if (statusCounts[status] === undefined) {
      statusCounts[status] = 0;
    }

    statusCounts[status] += 1;

    if (status !== "Anulată") {
      totalRevenue += totalPrice;
    }

    if (status !== "Livrată" && status !== "Anulată") {
      activeOrders += 1;
    }

    if (status === "Livrată") {
      deliveredOrders += 1;
    }

    if (status === "Anulată") {
      cancelledOrders += 1;
    }

    if (order.paid) {
      paidOrders += 1;
    } else {
      unpaidOrders += 1;
    }

    if (order.userEmail) {
      customerEmails.add(String(order.userEmail).toLowerCase());
    }

    if (createdAt) {
      const createdDay = getStartOfDay(createdAt);

      if (createdDay.getTime() === today.getTime()) {
        todayOrders += 1;

        if (status !== "Anulată") {
          todayRevenue += totalPrice;
        }
      }

      const iso = getIsoDate(createdDay);

      if (last7DaysMap.has(iso)) {
        const day = last7DaysMap.get(iso);
        day.orders += 1;

        if (status !== "Anulată") {
          day.revenue += totalPrice;
        }
      }
    }

    const products = Array.isArray(order.products) ? order.products : [];

    for (const product of products) {
      const quantity = Number(product.quantity || 1);
      const price = Number(product.basePrice ?? product.price ?? 0);
      const name = product.name || "Produs";
      const image = product.image || "/pizza.png";
      const categoryName = getCategoryName(product, menuItemsById);

      totalProductsSold += quantity;

      if (!productMap.has(name)) {
        productMap.set(name, {
          name,
          image,
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

  const averageOrderValue =
    orders.length > 0
      ? Math.round((totalRevenue / orders.length) * 100) / 100
      : 0;

  return {
    totals: {
      totalOrders: orders.length,
      totalRevenue,
      todayOrders,
      todayRevenue,
      activeOrders,
      deliveredOrders,
      cancelledOrders,
      paidOrders,
      unpaidOrders,
      totalProductsSold,
      uniqueCustomers: customerEmails.size,
      averageOrderValue,
    },

    statusCounts,

    last7Days,

    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),

    categoryBreakdown: Array.from(categoryMap.values()).sort(
      (a, b) => b.quantity - a.quantity
    ),
  };
}

function serializeRecentOrder(order) {
  const products = Array.isArray(order.products) ? order.products : [];

  return {
    _id: String(order._id),
    customerName: order.customerName || "",
    phone: order.phone || "",
    city: order.city || "",
    address: order.address || "",
    status: order.status || "Nouă",
    paid: Boolean(order.paid),
    totalPrice: Number(order.totalPrice || 0),
    productsCount: products.reduce(
      (sum, product) => sum + Number(product.quantity || 1),
      0
    ),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function GET(req) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);

    if (!currentUser?.admin) {
      return NextResponse.json(
        {
          error: "Nu ai drepturi pentru accesarea dashboard-ului admin.",
        },
        { status: 403 }
      );
    }

    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    const menuItemsById = await buildMenuItemsById(orders);
    const stats = buildDashboardStats(orders, menuItemsById);
    const recentOrders = orders.slice(0, 8).map(serializeRecentOrder);

    return NextResponse.json({
      stats,
      recentOrders,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la încărcarea dashboard-ului.",
      },
      { status: 500 }
    );
  }
}