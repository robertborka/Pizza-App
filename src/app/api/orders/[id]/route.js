import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Order } from "@/app/models/order";
import { User } from "@/app/models/user";
import { connectToDatabase, isMissingDatabaseConfigError } from "@/libs/mongoose";
import { getOrderTotal, normalizeOrderProducts } from "@/libs/orderUtils";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["Nouă", "În pregătire", "Pe drum", "Livrată", "Anulată"];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizeStatus(value) {
  const status = cleanText(value);

  if (VALID_STATUSES.includes(status)) {
    return status;
  }

  return null;
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
    admin: Boolean(user?.admin),
  };
}

function serializeOrder(order) {
  if (!order) {
    return null;
  }

  return {
    _id: String(order._id),
    products: normalizeOrderProducts(order.products),
    totalPrice: getOrderTotal(order),
    status: normalizeStatus(order.status) || "Nouă",
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

export async function GET(req, { params }) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json(
        {
          error: "Trebuie să fii autentificat.",
        },
        { status: 401 }
      );
    }

    const orderId = params.id;

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
  } catch (error) {
    console.error("ORDER GET ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        { error: "Comanda nu este disponibilă momentan." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la încărcarea comenzii.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectToDatabase();

    const currentUser = await getCurrentUser(req);

    if (!currentUser?.admin) {
      return NextResponse.json(
        {
          error: "Nu ai drepturi pentru modificarea comenzilor.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();

    const updateData = {};

    if (body.status !== undefined) {
      const status = normalizeStatus(body.status);

      if (!status) {
        return NextResponse.json(
          {
            error: "Status invalid.",
          },
          { status: 400 }
        );
      }

      updateData.status = status;
    }

    if (body.paid !== undefined) {
      updateData.paid = Boolean(body.paid);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: "Nu ai trimis date pentru actualizare.",
        },
        { status: 400 }
      );
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      params.id,
      {
        $set: updateData,
      },
      {
        new: true,
      }
    ).lean();

    if (!updatedOrder) {
      return NextResponse.json(
        {
          error: "Comanda nu a fost găsită.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Comanda a fost actualizată.",
      order: serializeOrder(updatedOrder),
    });
  } catch (error) {
    console.error("ORDER PATCH ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        { error: "Comanda nu poate fi actualizată momentan." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la actualizarea comenzii.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req, context) {
  return PATCH(req, context);
}