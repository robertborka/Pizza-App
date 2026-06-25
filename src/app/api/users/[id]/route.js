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

export async function PATCH(req, { params }) {
  try {
    await connectToDatabase();

    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID utilizator invalid." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const updateData = {};

    if (body.admin !== undefined) {
      updateData.admin = Boolean(body.admin);
    }

    if (body.name !== undefined) {
      updateData.name = String(body.name || "").trim();
    }

    if (body.streetAddress !== undefined) {
      updateData.streetAddress = String(body.streetAddress || "").trim();
    }

    if (body.postalCode !== undefined) {
      updateData.postalCode = String(body.postalCode || "").trim();
    }

    if (body.city !== undefined) {
      updateData.city = String(body.city || "").trim();
    }

    if (body.country !== undefined) {
      updateData.country = String(body.country || "").trim();
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Utilizatorul nu a fost găsit." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Utilizatorul a fost actualizat.",
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error("USER UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la actualizarea utilizatorului." },
      { status: 500 }
    );
  }
}