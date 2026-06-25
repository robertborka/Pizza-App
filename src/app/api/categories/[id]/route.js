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

function createSlug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ş/g, "s")
    .replace(/ț/g, "t")
    .replace(/ţ/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serializeCategory(category) {
  return {
    _id: category._id.toString(),
    name: category.name,
    slug: category.slug || createSlug(category.name),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function PUT(req, { params }) {
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
        { error: "ID categorie invalid." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const slug = createSlug(body.slug || name);

    if (!name) {
      return NextResponse.json(
        { error: "Numele categoriei este obligatoriu." },
        { status: 400 }
      );
    }

    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name,
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Există deja o categorie cu acest nume." },
        { status: 400 }
      );
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name, slug },
      { returnDocument: "after" }
    );

    if (!updatedCategory) {
      return NextResponse.json(
        { error: "Categoria nu a fost găsită." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Categoria a fost actualizată.",
      category: serializeCategory(updatedCategory),
    });
  } catch (error) {
    console.error("CATEGORY UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la actualizarea categoriei." },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
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
        { error: "ID categorie invalid." },
        { status: 400 }
      );
    }

    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return NextResponse.json(
        { error: "Categoria nu a fost găsită." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Categoria a fost ștearsă.",
    });
  } catch (error) {
    console.error("CATEGORY DELETE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la ștergerea categoriei." },
      { status: 500 }
    );
  }
}
