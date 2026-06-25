import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Category } from "@/app/models/category";
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

function serializeCategory(category) {
  return {
    _id: category._id.toString(),
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
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

    const categories = await Category.find().sort({ createdAt: 1 });

    return NextResponse.json({
      categories: categories.map(serializeCategory),
    });
  } catch (error) {
    console.error("CATEGORIES GET ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la încărcarea categoriilor." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();

    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const body = await req.json();

    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Numele categoriei este obligatoriu." },
        { status: 400 }
      );
    }

    const existingCategory = await Category.findOne({ name });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Există deja o categorie cu acest nume." },
        { status: 400 }
      );
    }

    const createdCategory = await Category.create({
      name,
    });

    return NextResponse.json(
      {
        message: "Categoria a fost creată.",
        category: serializeCategory(createdCategory),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CATEGORY CREATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la crearea categoriei." },
      { status: 500 }
    );
  }
}