import mongoose from "mongoose";
import AIClient from "openai";
import { NextResponse } from "next/server";
import { MenuItem } from "@/app/models/menuItem";
import { Category } from "@/app/models/category";
import { Ingredient } from "@/app/models/ingredient";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE_MB = 8;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

async function connectToDatabase() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  await tryConnectToDatabase();
  return true;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isObjectIdLike(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function getCategoryName(category) {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    if (isObjectIdLike(category)) {
      return "";
    }

    return category;
  }

  return category.name || "";
}

function getIngredientNames(ingredients) {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
    .map((ingredient) => {
      if (!ingredient) {
        return "";
      }

      if (typeof ingredient === "string") {
        if (isObjectIdLike(ingredient)) {
          return "";
        }

        return ingredient;
      }

      return ingredient.name || "";
    })
    .filter(Boolean);
}

function serializeMenuItem(item) {
  const categoryName = getCategoryName(item.category);
  const ingredientNames = getIngredientNames(item.ingredients);

  return {
    _id: String(item._id || ""),
    name: item.name || "",
    description: item.description || "",
    image: item.image || "/pizza.png",
    basePrice: Number(item.basePrice ?? item.price ?? 0),
    price: Number(item.price ?? item.basePrice ?? 0),
    category: categoryName,
    ingredients: ingredientNames,
  };
}

async function loadMenuItems(databaseReady) {
  if (!databaseReady) {
    return [];
  }

  void Category;
  void Ingredient;

  const items = await MenuItem.find({ available: { $ne: false } })
    .sort({ createdAt: -1 })
    .populate("category")
    .populate("ingredients")
    .lean();

  return items.map(serializeMenuItem).filter((item) => item.name);
}

function buildMenuContext(menuItems) {
  return menuItems.slice(0, 100).map((item) => ({
    name: item.name,
    category: item.category,
    price: item.basePrice,
    description: item.description,
    ingredients: item.ingredients,
  }));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  const clean = cleanText(text);

  const direct = safeJsonParse(clean);

  if (direct) {
    return direct;
  }

  const startIndex = clean.indexOf("{");
  const endIndex = clean.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return safeJsonParse(clean.slice(startIndex, endIndex + 1));
}

function findProductByName(productName, menuItems) {
  const wantedName = normalizeText(productName);

  if (!wantedName) {
    return null;
  }

  const exact = menuItems.find((item) => normalizeText(item.name) === wantedName);

  if (exact) {
    return exact;
  }

  const partial = menuItems.find((item) =>
    normalizeText(item.name).includes(wantedName)
  );

  if (partial) {
    return partial;
  }

  return menuItems.find((item) => wantedName.includes(normalizeText(item.name)));
}

function scoreProductByIngredients(product, detectedIngredients) {
  const productText = normalizeText(
    [
      product.name,
      product.description,
      product.category,
      Array.isArray(product.ingredients) ? product.ingredients.join(" ") : "",
    ].join(" ")
  );

  const ingredients = Array.isArray(detectedIngredients)
    ? detectedIngredients
    : [];

  let score = 0;

  for (const ingredient of ingredients) {
    const normalizedIngredient = normalizeText(ingredient);

    if (!normalizedIngredient) {
      continue;
    }

    if (productText.includes(normalizedIngredient)) {
      score += 20;
    }
  }

  if (normalizeText(product.category).includes("pizza")) {
    score += 15;
  }

  return score;
}

function getFallbackRecommendation(menuItems, detectedIngredients = []) {
  const ranked = [...menuItems]
    .map((item) => ({
      item,
      score: scoreProductByIngredients(item, detectedIngredients),
    }))
    .sort((a, b) => b.score - a.score);

  const best =
    ranked.find((entry) => entry.score > 0)?.item ||
    menuItems.find((item) => normalizeText(item.category).includes("pizza")) ||
    menuItems[0] ||
    null;

  const alternatives = ranked
    .filter((entry) => entry.item?._id !== best?._id)
    .map((entry) => entry.item)
    .slice(0, 3);

  return {
    best,
    alternatives,
  };
}

function normalizeAiResult(parsed, menuItems) {
  const detectedIngredients = Array.isArray(parsed?.detectedIngredients)
    ? parsed.detectedIngredients.map(cleanText).filter(Boolean).slice(0, 12)
    : [];

  const bestMatchName =
    parsed?.bestMatch?.name ||
    parsed?.recommendedProductName ||
    parsed?.recommendedProduct ||
    "";

  let recommendedProduct = findProductByName(bestMatchName, menuItems);

  const alternativeNames = Array.isArray(parsed?.alternatives)
    ? parsed.alternatives
        .map((alternative) =>
          typeof alternative === "string" ? alternative : alternative?.name
        )
        .filter(Boolean)
    : [];

  let alternatives = alternativeNames
    .map((name) => findProductByName(name, menuItems))
    .filter(Boolean)
    .filter((item, index, arr) => {
      return arr.findIndex((other) => other._id === item._id) === index;
    })
    .filter((item) => item._id !== recommendedProduct?._id)
    .slice(0, 3);

  if (!recommendedProduct || alternatives.length === 0) {
    const fallback = getFallbackRecommendation(menuItems, detectedIngredients);

    if (!recommendedProduct) {
      recommendedProduct = fallback.best;
    }

    if (alternatives.length === 0) {
      alternatives = fallback.alternatives;
    }
  }

  const matchPercent = Number(
    parsed?.bestMatch?.matchPercent ??
      parsed?.matchPercent ??
      parsed?.confidence ??
      75
  );

  return {
    pizzaDetected: Boolean(parsed?.pizzaDetected ?? true),
    confidence: Math.max(
      0,
      Math.min(100, Number(parsed?.confidence ?? matchPercent ?? 75))
    ),
    matchPercent: Math.max(0, Math.min(100, matchPercent)),
    imageDescription:
      cleanText(parsed?.imageDescription) ||
      "Imaginea pare să conțină o pizza analizabilă vizual.",
    detectedIngredients,
    pizzaStyle: cleanText(parsed?.pizzaStyle) || "Stil italian / clasic",
    visualNotes: Array.isArray(parsed?.visualNotes)
      ? parsed.visualNotes.map(cleanText).filter(Boolean).slice(0, 4)
      : [],
    reason:
      cleanText(parsed?.bestMatch?.reason || parsed?.reason) ||
      "Produsul recomandat are ingrediente și aspect apropiate de pizza din imagine.",
    recommendedProduct,
    alternatives,
    tips: Array.isArray(parsed?.tips)
      ? parsed.tips.map(cleanText).filter(Boolean).slice(0, 4)
      : [
          "Pentru rezultate mai bune, folosește o poză clară, făcută de sus sau ușor lateral.",
          "Dacă pizza este acoperită de cutie sau folie, ingredientele pot fi detectate mai greu.",
        ],
  };
}

async function analyzeImageWithProvider({ file, menuItems, apiKey }) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString("base64");
  const mimeType = file.type || "image/png";

  const client = new AIClient({
    apiKey,
  });

  const model =
    process.env.AI_VISION_MODEL ||
    
    
    "gpt-4.1-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Ești un asistent AI pentru Top Family Pizza. Analizezi poza unei pizza și recomanzi cea mai apropiată pizza existentă în meniul restaurantului. Nu inventa produse. Recomandă doar produse din MENU_CONTEXT. Răspunde DOAR cu JSON valid.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              instructions:
                "Analizează imaginea. Identifică ingredientele vizibile, stilul pizzei, nivelul de încredere și produsul cel mai apropiat din meniu. Răspunde strict în JSON cu forma: { pizzaDetected: boolean, confidence: number, imageDescription: string, detectedIngredients: string[], pizzaStyle: string, visualNotes: string[], bestMatch: { name: string, matchPercent: number, reason: string }, alternatives: [{ name: string, reason: string }], tips: string[] }.",
              MENU_CONTEXT: buildMenuContext(menuItems),
            }),
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content || "";
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error("Răspunsul AI nu a putut fi interpretat ca JSON.");
  }

  return normalizeAiResult(parsed, menuItems);
}

function buildVisualFallback(menuItems) {
  const fallback = getFallbackRecommendation(menuItems, []);

  return {
    pizzaDetected: true,
    confidence: 50,
    matchPercent: 50,
    imageDescription:
      "Imaginea a fost încărcată, dar analiza vizuală avansată nu este disponibilă momentan.",
    detectedIngredients: [],
    pizzaStyle: "Necunoscut",
    visualNotes: [
      "A fost afișată o recomandare generală din meniul disponibil.",
      "Pentru rezultate mai bune, folosește o imagine clară, luminată și făcută de sus.",
    ],
    reason:
      "Recomandarea este generată din meniul disponibil, fără analiză vizuală completă.",
    recommendedProduct: fallback.best,
    alternatives: fallback.alternatives,
    tips: [
      "Fotografiază pizza de sus, cu ingredientele vizibile.",
      "Evită pozele foarte întunecate, mișcate sau făcute prea aproape.",
    ],
  };
}

export async function POST(req) {
  try {
    const databaseReady = await connectToDatabase();

    const formData = await req.formData();
    const file = formData.get("image");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        {
          error: "Nu a fost trimisă nicio imagine.",
        },
        { status: 400 }
      );
    }

    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json(
        {
          error: "Fișierul încărcat trebuie să fie o imagine.",
        },
        { status: 400 }
      );
    }

    if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Imaginea este prea mare. Limita este ${MAX_IMAGE_SIZE_MB} MB.`,
        },
        { status: 400 }
      );
    }

    const menuItems = await loadMenuItems(databaseReady);

    if (menuItems.length === 0) {
      return NextResponse.json(
        {
          error: "Nu există produse în meniu pentru recomandare.",
        },
        { status: 400 }
      );
    }

    const aiApiKey = process.env.AI_PROVIDER_API_KEY;
    let analysis = null;
    let source = "Reguli interne";

    if (aiApiKey) {
      try {
        analysis = await analyzeImageWithProvider({
          file,
          menuItems,
          apiKey: aiApiKey,
        });
        source = "Analiză vizuală";
      } catch (analysisError) {
        console.error("AI_PIZZA_PROVIDER_FALLBACK:", analysisError);
        analysis = buildVisualFallback(menuItems);
      }
    } else {
      analysis = buildVisualFallback(menuItems);
    }

    return NextResponse.json({
      ok: true,
      source,
      analysis,
      recommendedProduct: analysis.recommendedProduct || null,
      alternatives: analysis.alternatives || [],
    });
  } catch (error) {
    console.error("AI PIZZA RECOGNITION ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la analiza imaginii.",
      },
      { status: 500 }
    );
  }
}