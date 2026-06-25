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

    const ingredients = await Ingredient.find().sort({ name: 1 });

    return NextResponse.json({
      ingredients: ingredients.map(serializeIngredient),
    });
  } catch (error) {
    console.error("INGREDIENTS GET ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la încărcarea ingredientelor." },
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

    const existingIngredient = await Ingredient.findOne({
      $or: [{ name }, { slug }],
    });

    if (existingIngredient) {
      return NextResponse.json(
        { error: "Există deja un ingredient cu acest nume sau slug." },
        { status: 400 }
      );
    }

    const createdIngredient = await Ingredient.create({
      name,
      slug,
      image,
      aliases,
    });

    return NextResponse.json(
      {
        message: "Ingredientul a fost creat.",
        ingredient: serializeIngredient(createdIngredient),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("INGREDIENT CREATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la crearea ingredientului." },
      { status: 500 }
    );
  }
}