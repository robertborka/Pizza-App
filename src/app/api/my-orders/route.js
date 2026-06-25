import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase, isMissingDatabaseConfigError } from "@/libs/mongoose";
import { getOrderTotal, normalizeOrderProducts, normalizeOrderStatus } from "@/libs/orderUtils";

export const dynamic = "force-dynamic";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function serializeOrder(order) {
  return {
    _id: order._id.toString(),
    userEmail: order.userEmail || "",
    customerName: order.customerName || "",
    phone: order.phone || "",
    city: order.city || "",
    address: order.address || "",
    notes: order.notes || "",
    products: normalizeOrderProducts(order.products),
    totalPrice: getOrderTotal(order),
    status: normalizeOrderStatus(order.status),
    paid: Boolean(order.paid),
    deliveryEstimate: order.deliveryEstimate || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function GET() {
  try {
    await connectToDatabase();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Trebuie să fii autentificat." },
        { status: 401 }
      );
    }

    const orders = await mongoose.connection
      .collection("orders")
      .find({
        userEmail: normalizeEmail(session.user.email),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      orders: orders.map(serializeOrder),
    });
  } catch (error) {
    console.error("MY ORDERS GET ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        {
          error:
            "Istoricul comenzilor nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "A apărut o eroare la încărcarea comenzilor tale." },
      { status: 500 }
    );
  }
}