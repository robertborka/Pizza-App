import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { User } from "@/app/models/user";
import { requireAdmin } from "@/libs/isAdmin";

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

function serializeUser(user) {
  return {
    _id: user._id.toString(),
    name: user.name || "",
    email: user.email || "",
    image: user.image || "",
    admin: Boolean(user.admin),
    streetAddress: user.streetAddress || "",
    postalCode: user.postalCode || "",
    city: user.city || "",
    country: user.country || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET() {
  try {
    await connectToDatabase();

    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const users = await User.find().sort({ createdAt: -1 });

    return NextResponse.json({
      users: users.map(serializeUser),
    });
  } catch (error) {
    console.error("USERS GET ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la încărcarea utilizatorilor." },
      { status: 500 }
    );
  }
}