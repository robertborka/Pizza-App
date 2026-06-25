import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { MenuItem } from "@/app/models/menuItem";
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

function isValidImagePath(value) {
  const image = String(value || "").trim();

  if (!image) {
    return true;
  }

  return image.startsWith("/") || image.startsWith("http://") || image.startsWith("https://");
}

function serializeMenuItem(item) {
  return {
    _id: item._id.toString(),
    name: item.name,
    description: item.description || "",
    basePrice: Number(item.basePrice ?? item.price ?? 0),
    price: Number(item.price ?? item.basePrice ?? 0),
    image: item.image || "/pizza.png",
    available: item.available !== false,
    category: item.category,
    ingredients: item.ingredients || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
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
        { error: "ID produs invalid." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const image = String(body.image || "").trim() || "/pizza.png";
    const basePrice = Number(body.basePrice || 0);
    const category = String(body.category || "").trim();
    const available = body.available === undefined ? true : Boolean(body.available);

    const ingredients = Array.isArray(body.ingredients)
      ? body.ingredients.filter((ingredientId) =>
          mongoose.Types.ObjectId.isValid(ingredientId)
        )
      : [];

    if (!name) {
      return NextResponse.json(
        { error: "Numele produsului este obligatoriu." },
        { status: 400 }
      );
    }

    if (!basePrice || basePrice <= 0) {
      return NextResponse.json(
        { error: "Prețul trebuie să fie mai mare decât 0." },
        { status: 400 }
      );
    }

    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return NextResponse.json(
        { error: "Categoria produsului este obligatorie." },
        { status: 400 }
      );
    }

    if (!isValidImagePath(image)) {
      return NextResponse.json(
        { error: "Imaginea trebuie să fie un URL valid sau o cale internă care începe cu /." },
        { status: 400 }
      );
    }

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
      {
        name,
        description,
        basePrice,
        price: basePrice,
        image,
        available,
        category,
        ingredients,
      },
      { returnDocument: "after" }
    )
      .populate("category")
      .populate("ingredients");

    if (!updatedMenuItem) {
      return NextResponse.json(
        { error: "Produsul nu a fost găsit." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Produsul a fost actualizat.",
      menuItem: serializeMenuItem(updatedMenuItem),
    });
  } catch (error) {
    console.error("MENU ITEM UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la actualizarea produsului." },
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
        { error: "ID produs invalid." },
        { status: 400 }
      );
    }

    const deletedMenuItem = await MenuItem.findByIdAndDelete(id);

    if (!deletedMenuItem) {
      return NextResponse.json(
        { error: "Produsul nu a fost găsit." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Produsul a fost șters.",
    });
  } catch (error) {
    console.error("MENU ITEM DELETE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la ștergerea produsului." },
      { status: 500 }
    );
  }
}