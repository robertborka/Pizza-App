import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { Ingredient } from "@/app/models/ingredient";
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

function serializeIngredient(ingredient) {
  return {
    _id: ingredient._id.toString(),
    name: ingredient.name,
    slug: ingredient.slug,
    image: ingredient.image || "",
    aliases: ingredient.aliases || [],
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt,
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
        { error: "ID ingredient invalid." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const name = String(body.name || "").trim();
    const image = String(body.image || "").trim();
    const aliases = Array.isArray(body.aliases)
      ? body.aliases.map((alias) => String(alias).trim()).filter(Boolean)
      : [];

    const slug = String(body.slug || createSlug(name)).trim();

    if (!name) {
      return NextResponse.json(
        { error: "Numele ingredientului este obligatoriu." },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Slug-ul ingredientului este obligatoriu." },
        { status: 400 }
      );
    }

    const updatedIngredient = await Ingredient.findByIdAndUpdate(
      id,
      {
        name,
        slug,
        image,
        aliases,
      },
      { new: true }
    );

    if (!updatedIngredient) {
      return NextResponse.json(
        { error: "Ingredientul nu a fost găsit." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Ingredientul a fost actualizat.",
      ingredient: serializeIngredient(updatedIngredient),
    });
  } catch (error) {
    console.error("INGREDIENT UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la actualizarea ingredientului." },
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
        { error: "ID ingredient invalid." },
        { status: 400 }
      );
    }

    const deletedIngredient = await Ingredient.findByIdAndDelete(id);

    if (!deletedIngredient) {
      return NextResponse.json(
        { error: "Ingredientul nu a fost găsit." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Ingredientul a fost șters.",
    });
  } catch (error) {
    console.error("INGREDIENT DELETE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la ștergerea ingredientului." },
      { status: 500 }
    );
  }
}