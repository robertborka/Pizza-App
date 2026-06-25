import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Order } from "@/app/models/order";
import { User } from "@/app/models/user";
import { MenuItem } from "@/app/models/menuItem";
import { connectToDatabase, isMissingDatabaseConfigError } from "@/libs/mongoose";
import {
  calculateOrderProductsTotal,
  getOrderTotal,
  normalizeOrderProducts,
} from "@/libs/orderUtils";
import { sendNewOrderEmail } from "@/libs/email";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["Nouă", "În pregătire", "Pe drum", "Livrată", "Anulată"];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function normalizeStatus(value) {
  const status = cleanText(value);

  if (VALID_STATUSES.includes(status)) {
    return status;
  }

  return "Nouă";
}

async function getCurrentUser(req) {
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

  const user = await User.findOne({ email }).lean();

  return {
    email,
    name: token.name || user?.name || "",
    admin: Boolean(user?.admin),
  };
}

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

function getProductId(product) {
  return String(product?._id || product?.id || product?.productId || "");
}

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

function groupCartProducts(cartProducts) {
  const grouped = new Map();

  for (const product of cartProducts) {
    const productId = getProductId(product);

    if (!productId) {
      continue;
    }

    const incomingQuantity = Math.max(1, Math.round(Number(product.quantity || 1)));
    const unitPrice = getProductPrice(product);
    const existingProduct = grouped.get(productId);

    if (existingProduct) {
      existingProduct.quantity += incomingQuantity;
      existingProduct.lineTotal = existingProduct.quantity * existingProduct.price;
      continue;
    }

    grouped.set(productId, {
      productId,
      _id: productId,
      name: product.name || "Produs",
      description: product.description || "",
      image: product.image || "/pizza.png",
      category: product.category || null,
      ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
      basePrice: unitPrice,
      price: unitPrice,
      quantity: incomingQuantity,
      lineTotal: unitPrice * incomingQuantity,
    });
  }

  return Array.from(grouped.values());
}

async function validateAndHydrateProducts(groupedProducts) {
  const productIds = groupedProducts
    .map((product) => product.productId)
    .filter(isObjectIdLike);

  if (productIds.length !== groupedProducts.length) {
    return {
      ok: false,
      error: "Un produs din coș nu este valid.",
      products: [],
    };
  }

  const menuItems = await MenuItem.find({
    _id: { $in: productIds },
    available: { $ne: false },
  }).lean();

  const menuItemsById = new Map(
    menuItems.map((item) => [String(item._id), item])
  );

  if (menuItemsById.size !== groupedProducts.length) {
    return {
      ok: false,
      error: "Un produs din coș nu mai este disponibil.",
      products: [],
    };
  }

  const products = groupedProducts.map((groupedProduct) => {
    const menuItem = menuItemsById.get(groupedProduct.productId);
    const price = Number(menuItem.basePrice ?? menuItem.price ?? 0);
    const quantity = Math.max(1, Math.round(Number(groupedProduct.quantity || 1)));

    return {
      productId: String(menuItem._id),
      _id: String(menuItem._id),
      name: menuItem.name || "Produs",
      description: menuItem.description || "",
      image: menuItem.image || "/pizza.png",
      category: menuItem.category || null,
      ingredients: Array.isArray(menuItem.ingredients) ? menuItem.ingredients : [],
      basePrice: price,
      price,
      quantity,
      lineTotal: price * quantity,
    };
  });

  return {
    ok: true,
    products,
  };
}

function calculateTotal(products) {
  return calculateOrderProductsTotal(products);
}

function serializeOrder(order) {
  if (!order) {
    return null;
  }

  return {
    _id: String(order._id),
    products: normalizeOrderProducts(order.products),
    totalPrice: getOrderTotal(order),
    status: normalizeStatus(order.status),
    paid: Boolean(order.paid),

    customerName: order.customerName || "",
    phone: order.phone || "",
    city: order.city || "",
    address: order.address || "",

    street: order.street || "",
    streetNumber: order.streetNumber || "",
    building: order.building || "",
    entrance: order.entrance || "",
    floor: order.floor || "",
    apartment: order.apartment || "",
    notes: order.notes || "",

    userEmail: order.userEmail || "",
    deliveryEstimate: order.deliveryEstimate || null,

    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function GET(req) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "Trebuie să fii autentificat pentru a vedea comenzile.",
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (orderId) {
      const query = currentUser.admin
        ? { _id: orderId }
        : { _id: orderId, userEmail: currentUser.email };

      const order = await Order.findOne(query).lean();

      if (!order) {
        return NextResponse.json(
          {
            error: "Comanda nu a fost găsită.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        order: serializeOrder(order),
      });
    }

    const query = currentUser.admin ? {} : { userEmail: currentUser.email };

    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const serializedOrders = orders.map(serializeOrder);

    return NextResponse.json({
      orders: serializedOrders,
    });
  } catch (error) {
    console.error("ORDERS GET ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        {
          error:
            "Serviciul de comenzi nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la încărcarea comenzilor.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);
    const body = await req.json();

    const cartProducts = Array.isArray(body.cartProducts)
      ? body.cartProducts
      : [];

    if (cartProducts.length === 0) {
      return NextResponse.json(
        {
          error: "Coșul este gol.",
        },
        { status: 400 }
      );
    }

    const groupedProducts = groupCartProducts(cartProducts);

    if (groupedProducts.length === 0) {
      return NextResponse.json(
        {
          error: "Produsele din coș nu sunt valide.",
        },
        { status: 400 }
      );
    }

    const hydratedProductsResult = await validateAndHydrateProducts(groupedProducts);

    if (!hydratedProductsResult.ok) {
      return NextResponse.json(
        { error: hydratedProductsResult.error },
        { status: 400 }
      );
    }

    const orderProducts = hydratedProductsResult.products;
    const customerData = body.customerData || {};
    const totalPrice = calculateTotal(orderProducts);

    const userEmail = normalizeEmail(
      currentUser?.email || body.userEmail || customerData.email || ""
    );

    const cleanCustomerData = {
      name: cleanText(customerData.name),
      phone: cleanText(customerData.phone),
      city: cleanText(customerData.city),
      address: cleanText(customerData.address),
      street: cleanText(customerData.street),
      streetNumber: cleanText(customerData.streetNumber),
      building: cleanText(customerData.building),
      entrance: cleanText(customerData.entrance),
      floor: cleanText(customerData.floor),
      apartment: cleanText(customerData.apartment),
      notes: cleanText(customerData.notes),
    };

    if (!cleanCustomerData.name) {
      return NextResponse.json(
        { error: "Completează numele pentru comandă." },
        { status: 400 }
      );
    }

    if (!isValidPhone(cleanCustomerData.phone)) {
      return NextResponse.json(
        { error: "Completează un număr de telefon valid." },
        { status: 400 }
      );
    }

    if (!cleanCustomerData.city) {
      return NextResponse.json(
        { error: "Completează orașul." },
        { status: 400 }
      );
    }

    if (!cleanCustomerData.street || !cleanCustomerData.streetNumber) {
      return NextResponse.json(
        { error: "Completează strada și numărul pentru livrare." },
        { status: 400 }
      );
    }

    const order = await Order.create({
      products: orderProducts,
      totalPrice,
      status: "Nouă",
      paid: false,

      customerName: cleanCustomerData.name,
      phone: cleanCustomerData.phone,
      city: cleanCustomerData.city,
      address: cleanCustomerData.address,

      street: cleanCustomerData.street,
      streetNumber: cleanCustomerData.streetNumber,
      building: cleanCustomerData.building,
      entrance: cleanCustomerData.entrance,
      floor: cleanCustomerData.floor,
      apartment: cleanCustomerData.apartment,
      notes: cleanCustomerData.notes,

      userEmail,
      deliveryEstimate: null,
    });

    let notificationSent = false;

    try {
      await sendNewOrderEmail(order);
      notificationSent = true;
    } catch (emailError) {
      console.error("ORDER_EMAIL_NOTIFICATION_ERROR:", emailError);
    }

    return NextResponse.json(
      {
        message: "Comanda a fost plasată cu succes.",
        notificationSent,
        order: serializeOrder(order),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ORDERS POST ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        {
          error:
            "Serviciul de comenzi nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la plasarea comenzii.",
      },
      { status: 500 }
    );
  }
}