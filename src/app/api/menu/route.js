import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { MenuItem } from "@/app/models/menuItem";
import { Category } from "@/app/models/category";
import { Ingredient } from "@/app/models/ingredient";
import { connectToDatabase } from "@/libs/mongoose";
import { requireAdmin } from "@/libs/isAdmin";

export const dynamic = "force-dynamic";

function isObjectIdLike(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function cleanText(value) {
  return String(value || "").trim();
}

function serializeCategory(category, categoriesById = new Map()) {
  if (!category) {
    return null;
  }

  if (typeof category === "object" && category.name) {
    return {
      _id: String(category._id || ""),
      name: category.name || "",
    };
  }

  const categoryId = String(category || "");

  if (categoriesById.has(categoryId)) {
    const foundCategory = categoriesById.get(categoryId);

    return {
      _id: String(foundCategory._id || ""),
      name: foundCategory.name || "",
    };
  }

  if (!isObjectIdLike(categoryId) && categoryId) {
    return {
      _id: "",
      name: categoryId,
    };
  }

  return null;
}

function serializeIngredient(ingredient, ingredientsById = new Map()) {
  if (!ingredient) {
    return null;
  }

  if (typeof ingredient === "object" && ingredient.name) {
    return {
      _id: String(ingredient._id || ""),
      name: ingredient.name || "",
      image: ingredient.image || "",
      price: Number(ingredient.price ?? ingredient.extraPrice ?? 0),
      extraPrice: Number(ingredient.extraPrice ?? ingredient.price ?? 0),
    };
  }

  const ingredientId = String(ingredient || "");

  if (ingredientsById.has(ingredientId)) {
    const foundIngredient = ingredientsById.get(ingredientId);

    return {
      _id: String(foundIngredient._id || ""),
      name: foundIngredient.name || "",
      image: foundIngredient.image || "",
      price: Number(foundIngredient.price ?? foundIngredient.extraPrice ?? 0),
      extraPrice: Number(foundIngredient.extraPrice ?? foundIngredient.price ?? 0),
    };
  }

  if (!isObjectIdLike(ingredientId) && ingredientId) {
    return {
      _id: "",
      name: ingredientId,
      image: "",
      price: 0,
      extraPrice: 0,
    };
  }

  return null;
}

function getRawIngredients(item) {
  if (Array.isArray(item.ingredients)) {
    return item.ingredients;
  }

  if (Array.isArray(item.ingredientIds)) {
    return item.ingredientIds;
  }

  if (Array.isArray(item.selectedIngredients)) {
    return item.selectedIngredients;
  }

  if (Array.isArray(item.ingrediente)) {
    return item.ingrediente;
  }

  return [];
}

function collectReferencedIds(menuItems) {
  const categoryIds = new Set();
  const ingredientIds = new Set();

  for (const item of menuItems) {
    if (item.category && isObjectIdLike(item.category)) {
      categoryIds.add(String(item.category));
    }

    const rawIngredients = getRawIngredients(item);

    for (const ingredient of rawIngredients) {
      if (ingredient && typeof ingredient === "object" && ingredient._id) {
        continue;
      }

      if (isObjectIdLike(ingredient)) {
        ingredientIds.add(String(ingredient));
      }
    }
  }

  return {
    categoryIds: Array.from(categoryIds),
    ingredientIds: Array.from(ingredientIds),
  };
}

function serializeMenuItem(item, categoriesById, ingredientsById) {
  const rawIngredients = getRawIngredients(item);

  const ingredients = rawIngredients
    .map((ingredient) => serializeIngredient(ingredient, ingredientsById))
    .filter(Boolean)
    .filter((ingredient) => cleanText(ingredient.name));

  const category = serializeCategory(item.category, categoriesById);

  return {
    _id: String(item._id || ""),
    name: item.name || "",
    description: item.description || "",
    image: item.image || "/pizza.png",
    basePrice: Number(item.basePrice ?? item.price ?? 0),
    price: Number(item.price ?? item.basePrice ?? 0),
    category,
    ingredients,
    sizes: Array.isArray(item.sizes) ? item.sizes : [],
    extraIngredientPrices: Array.isArray(item.extraIngredientPrices)
      ? item.extraIngredientPrices
      : [],
    available: item.available !== false,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function GET() {
  try {
    await connectToDatabase();

    void Category;
    void Ingredient;

    const menuItems = await MenuItem.find({ available: { $ne: false } })
      .sort({ createdAt: -1 })
      .populate("category")
      .populate("ingredients")
      .lean();

    const { categoryIds, ingredientIds } = collectReferencedIds(menuItems);

    const [categories, ingredients] = await Promise.all([
      categoryIds.length > 0
        ? Category.find({ _id: { $in: categoryIds } }).lean()
        : [],
      ingredientIds.length > 0
        ? Ingredient.find({ _id: { $in: ingredientIds } }).lean()
        : [],
    ]);

    const categoriesById = new Map(
      categories.map((category) => [String(category._id), category])
    );

    const ingredientsById = new Map(
      ingredients.map((ingredient) => [String(ingredient._id), ingredient])
    );

    const serializedItems = menuItems.map((item) =>
      serializeMenuItem(item, categoriesById, ingredientsById)
    );

    return NextResponse.json({
      menuItems: serializedItems,
      products: serializedItems,
      items: serializedItems,
    });
  } catch (error) {
    console.error("MENU GET ERROR:", error);

    return NextResponse.json(
      {
        error: "Meniul nu este disponibil momentan.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();

    const body = await req.json();

    const createdItem = await MenuItem.create({
      name: cleanText(body.name),
      description: cleanText(body.description),
      image: cleanText(body.image) || "/pizza.png",
      basePrice: Number(body.basePrice ?? body.price ?? 0),
      price: Number(body.price ?? body.basePrice ?? 0),
      category: body.category || null,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      sizes: Array.isArray(body.sizes) ? body.sizes : [],
      extraIngredientPrices: Array.isArray(body.extraIngredientPrices)
        ? body.extraIngredientPrices
        : [],
    });

    const populatedItem = await MenuItem.findById(createdItem._id)
      .populate("category")
      .populate("ingredients")
      .lean();

    return NextResponse.json(
      {
        message: "Produsul a fost creat cu succes.",
        item: serializeMenuItem(populatedItem, new Map(), new Map()),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("MENU POST ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la salvarea produsului.",
      },
      { status: 500 }
    );
  }
}