import mongoose from "mongoose";
import { NextResponse } from "next/server";
import AIClient from "openai";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

export const dynamic = "force-dynamic";


async function connectToDatabase() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  await tryConnectToDatabase();
  return true;
}

function idToString(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value.toString) {
    return value.toString();
  }

  return String(value);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonFromText(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function clampScore(value) {
  const number = Number(value || 0);

  if (Number.isNaN(number)) {
    return 75;
  }

  return Math.min(Math.max(Math.round(number), 1), 100);
}

function groupCartProducts(cartProducts) {
  const grouped = {};

  for (const product of cartProducts) {
    const productId = idToString(product?._id || product?.id);

    if (!productId) {
      continue;
    }

    if (!grouped[productId]) {
      grouped[productId] = {
        productId,
        quantity: 0,
        fallbackProduct: product,
      };
    }

    grouped[productId].quantity += 1;
  }

  return Object.values(grouped);
}

function serializeMenuItem(item, categoryMap, ingredientMap) {
  const categoryId = idToString(item.category);

  const ingredientIds = Array.isArray(item.ingredients)
    ? item.ingredients.map(idToString)
    : [];

  return {
    _id: idToString(item._id),
    name: item.name || "",
    description: item.description || "",
    image: item.image || "/pizza.png",
    basePrice: Number(item.basePrice || 0),
    category: categoryId,
    categoryName: categoryMap.get(categoryId)?.name || "",
    ingredients: ingredientIds
      .map((ingredientId) => ingredientMap.get(ingredientId)?.name)
      .filter(Boolean),
  };
}

function getProductText(product) {
  return normalizeText(
    [
      product.name,
      product.description,
      product.categoryName,
      Array.isArray(product.ingredients) ? product.ingredients.join(" ") : "",
    ].join(" ")
  );
}

function detectProductType(product) {
  const text = getProductText(product);

  if (text.includes("pizza")) {
    return "pizza";
  }

  if (
    text.includes("sos") ||
    text.includes("usturoi") ||
    text.includes("bbq") ||
    text.includes("ranch") ||
    text.includes("cheddar") ||
    text.includes("pesto") ||
    text.includes("curry")
  ) {
    return "sos";
  }

  if (
    text.includes("baut") ||
    text.includes("băut") ||
    text.includes("limonada") ||
    text.includes("limonad") ||
    text.includes("cola") ||
    text.includes("pepsi") ||
    text.includes("fanta") ||
    text.includes("sprite") ||
    text.includes("apa") ||
    text.includes("apă") ||
    text.includes("suc")
  ) {
    return "bautura";
  }

  if (
    text.includes("desert") ||
    text.includes("tiramisu") ||
    text.includes("papanasi") ||
    text.includes("papana") ||
    text.includes("clatite") ||
    text.includes("clătite") ||
    text.includes("nutella") ||
    text.includes("ciocolata") ||
    text.includes("ciocolată") ||
    text.includes("profiterol") ||
    text.includes("gogosi") ||
    text.includes("gogoși")
  ) {
    return "desert";
  }

  return "extra";
}

function getCartContext(cartProducts) {
  const types = cartProducts.map(detectProductType);

  const hasPizza = types.includes("pizza");
  const hasSauce = types.includes("sos");
  const hasDrink = types.includes("bautura");
  const hasDessert = types.includes("desert");

  const onlyDessert =
    cartProducts.length > 0 &&
    hasDessert &&
    !hasPizza &&
    !hasSauce &&
    !hasDrink &&
    types.every((type) => type === "desert");

  const onlyDrink =
    cartProducts.length > 0 &&
    hasDrink &&
    !hasPizza &&
    !hasSauce &&
    !hasDessert &&
    types.every((type) => type === "bautura");

  const onlySauce =
    cartProducts.length > 0 &&
    hasSauce &&
    !hasPizza &&
    !hasDrink &&
    !hasDessert &&
    types.every((type) => type === "sos");

  return {
    types,
    hasPizza,
    hasSauce,
    hasDrink,
    hasDessert,
    onlyDessert,
    onlyDrink,
    onlySauce,
  };
}

function isAllowedRecommendationType(product, cartContext) {
  const type = detectProductType(product);

  if (cartContext.onlyDessert) {
    return type === "bautura" || type === "desert";
  }

  if (cartContext.onlyDrink) {
    return type === "pizza" || type === "desert";
  }

  if (cartContext.onlySauce) {
    return type === "pizza" || type === "bautura";
  }

  if (cartContext.hasPizza) {
    return type === "sos" || type === "bautura" || type === "desert";
  }

  if (cartContext.hasDessert && !cartContext.hasPizza) {
    return type === "bautura" || type === "desert";
  }

  return (
    type === "sos" ||
    type === "bautura" ||
    type === "desert" ||
    type === "pizza"
  );
}

function isRecommendationCandidate(product, cartContext) {
  const type = detectProductType(product);

  if (!isAllowedRecommendationType(product, cartContext)) {
    return false;
  }

  return ["sos", "bautura", "desert", "pizza", "extra"].includes(type);
}

function scoreCandidate(product, cartText, wantedType, cartContext) {
  const text = getProductText(product);
  const productType = detectProductType(product);

  let score = 0;

  if (wantedType === productType) {
    score += 120;
  }

  if (cartContext.onlyDessert) {
    if (productType === "bautura") score += 140;
    if (text.includes("cola")) score += 50;
    if (text.includes("apa") || text.includes("apă")) score += 40;
    if (text.includes("limonada") || text.includes("limonad")) score += 60;
    if (text.includes("suc")) score += 45;

    if (productType === "desert") score += 30;

    if (productType === "sos") score -= 1000;
    if (productType === "pizza") score -= 200;

    if (cartText.includes("nutella") || cartText.includes("ciocolata")) {
      if (text.includes("cola")) score += 35;
      if (text.includes("lapte")) score += 35;
    }

    return score;
  }

  const spicyCart =
    cartText.includes("picant") ||
    cartText.includes("iute") ||
    cartText.includes("jalapeno") ||
    cartText.includes("diavola") ||
    cartText.includes("inferno") ||
    cartText.includes("hot");

  const cheeseCart =
    cartText.includes("quattro") ||
    cartText.includes("branza") ||
    cartText.includes("brânză") ||
    cartText.includes("formaggi") ||
    cartText.includes("mozzarella");

  const tunaCart =
    cartText.includes("ton") ||
    cartText.includes("tonno") ||
    cartText.includes("cipolla");

  if (wantedType === "sos") {
    if (spicyCart && text.includes("usturoi")) score += 70;
    if (spicyCart && text.includes("ranch")) score += 55;
    if (cheeseCart && text.includes("picant")) score += 40;
    if (tunaCart && text.includes("rosii")) score += 35;
    if (tunaCart && text.includes("roșii")) score += 35;
    if (text.includes("bbq")) score += 25;
  }

  if (wantedType === "bautura") {
    if (spicyCart && text.includes("limonada")) score += 80;
    if (spicyCart && text.includes("limonad")) score += 80;
    if (spicyCart && text.includes("cola")) score += 50;
    if (text.includes("apa")) score += 30;
    if (text.includes("apă")) score += 30;
    if (text.includes("suc")) score += 30;
  }

  if (wantedType === "desert") {
    if (text.includes("tiramisu")) score += 70;
    if (text.includes("papanasi") || text.includes("papana")) score += 60;
    if (text.includes("clatite") || text.includes("clătite")) score += 50;
    if (text.includes("ciocolata") || text.includes("ciocolată")) score += 45;
    if (text.includes("nutella")) score += 45;
  }

  return score;
}

function pickBestCandidate(candidates, cartText, wantedType, usedIds, cartContext) {
  return candidates
    .filter((product) => !usedIds.has(product._id))
    .filter((product) => isAllowedRecommendationType(product, cartContext))
    .map((product) => ({
      product,
      score: scoreCandidate(product, cartText, wantedType, cartContext),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.product;
}

function createFallbackRecommendations(cartProducts, candidates) {
  const cartContext = getCartContext(cartProducts);

  const cartText = normalizeText(
    cartProducts.map((product) => getProductText(product)).join(" ")
  );

  const usedIds = new Set();
  const recommendations = [];

  if (cartContext.onlyDessert) {
    const drink = pickBestCandidate(
      candidates,
      cartText,
      "bautura",
      usedIds,
      cartContext
    );

    if (drink) {
      usedIds.add(drink._id);

      recommendations.push({
        product: drink,
        type: "bautura",
        badge: "Băutură recomandată",
        matchScore: 90,
        reason:
          "O băutură rece completează natural un desert și echilibrează comanda.",
      });
    }

    const dessert = pickBestCandidate(
      candidates,
      cartText,
      "desert",
      usedIds,
      cartContext
    );

    if (dessert) {
      usedIds.add(dessert._id);

      recommendations.push({
        product: dessert,
        type: "desert",
        badge: "Desert complementar",
        matchScore: 80,
        reason:
          "Acest desert se potrivește cu selecția din coș și poate completa comanda.",
      });
    }

    return {
      summary:
        "Coșul conține deserturi, așa că recomandările sunt orientate către băuturi sau alte produse dulci potrivite.",
      recommendations,
      aiUsed: false,
      source: "fallback_contextual",
    };
  }

  if (cartContext.hasPizza) {
    const sauce = pickBestCandidate(
      candidates,
      cartText,
      "sos",
      usedIds,
      cartContext
    );

    if (sauce) {
      usedIds.add(sauce._id);

      recommendations.push({
        product: sauce,
        type: "sos",
        badge: "Sos potrivit",
        matchScore: 87,
        reason:
          "Acest sos completează bine pizza aleasă și adaugă un plus de gust comenzii.",
      });
    }

    const drink = pickBestCandidate(
      candidates,
      cartText,
      "bautura",
      usedIds,
      cartContext
    );

    if (drink) {
      usedIds.add(drink._id);

      recommendations.push({
        product: drink,
        type: "bautura",
        badge: "Băutură recomandată",
        matchScore: 84,
        reason:
          "O băutură rece se potrivește bine cu pizza și completează comanda.",
      });
    }

    const dessert = pickBestCandidate(
      candidates,
      cartText,
      "desert",
      usedIds,
      cartContext
    );

    if (dessert) {
      usedIds.add(dessert._id);

      recommendations.push({
        product: dessert,
        type: "desert",
        badge: "Desert recomandat",
        matchScore: 81,
        reason:
          "Un desert este o completare potrivită după produsele principale din comandă.",
      });
    }

    return {
      summary:
        "Pe baza produselor din coș, recomandările includ opțiuni care pot completa comanda: sosuri, băuturi sau deserturi.",
      recommendations,
      aiUsed: false,
      source: "fallback_contextual",
    };
  }

  const drink = pickBestCandidate(
    candidates,
    cartText,
    "bautura",
    usedIds,
    cartContext
  );

  if (drink) {
    usedIds.add(drink._id);

    recommendations.push({
      product: drink,
      type: "bautura",
      badge: "Băutură recomandată",
      matchScore: 82,
      reason:
        "Această băutură poate completa selecția actuală din coș.",
    });
  }

  const dessert = pickBestCandidate(
    candidates,
    cartText,
    "desert",
    usedIds,
    cartContext
  );

  if (dessert) {
    usedIds.add(dessert._id);

    recommendations.push({
      product: dessert,
      type: "desert",
      badge: "Desert recomandat",
      matchScore: 78,
      reason:
        "Acest desert este potrivit pentru completarea comenzii.",
    });
  }

  return {
    summary:
      "Recomandările sunt generate automat pe baza produselor din coș și a meniului disponibil.",
    recommendations,
    aiUsed: false,
    source: "fallback_contextual",
  };
}

function sanitizeAiRecommendations(aiResult, candidates, fallback, cartContext) {
  if (!aiResult || !Array.isArray(aiResult.recommendations)) {
    return fallback;
  }

  const candidateMap = new Map(
    candidates.map((product) => [product._id, product])
  );

  const usedIds = new Set();
  const recommendations = [];

  for (const item of aiResult.recommendations) {
    const productId = String(item.productId || "").trim();
    const product = candidateMap.get(productId);

    if (!product || usedIds.has(productId)) {
      continue;
    }

    if (!isAllowedRecommendationType(product, cartContext)) {
      continue;
    }

    usedIds.add(productId);

    recommendations.push({
      product,
      type: detectProductType(product),
      badge: String(item.badge || "Recomandare AI"),
      matchScore: clampScore(item.matchScore),
      reason: String(
        item.reason ||
          "Acest produs este recomandat pe baza selecției actuale din coș."
      ),
    });
  }

  if (recommendations.length === 0) {
    return fallback;
  }

  return {
    summary: String(
      aiResult.summary ||
        "Sistemul a analizat produsele din coș și a generat recomandări complementare."
    ),
    recommendations: recommendations.slice(0, 3),
    aiUsed: true,
    source: "motor_inteligent",
  };
}

async function generateAiRecommendations(cartProducts, candidates) {
  const cartContext = getCartContext(cartProducts);
  const fallback = createFallbackRecommendations(cartProducts, candidates);

  const aiApiKey = process.env.AI_PROVIDER_API_KEY;

  if (!aiApiKey) {
    return {
      ...fallback,
      source: "reguli_interne",
    };
  }

  if (!Array.isArray(cartProducts) || cartProducts.length === 0) {
    return {
      summary: "Coșul este gol.",
      recommendations: [],
      aiUsed: false,
      source: "empty_cart",
    };
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      summary: "Nu există produse disponibile pentru recomandări.",
      recommendations: [],
      aiUsed: false,
      source: "no_candidates",
    };
  }

  const allowedRule = cartContext.onlyDessert
    ? "Coșul conține doar deserturi. Recomandă doar băuturi sau alte deserturi. Nu recomanda sosuri."
    : cartContext.hasPizza
    ? "Coșul conține pizza. Poți recomanda sosuri, băuturi și deserturi."
    : "Recomandă doar produse complementare logice pentru coșul curent.";

  try {
    const menuForAi = candidates.slice(0, 40).map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description,
      category: product.categoryName,
      type: detectProductType(product),
      ingredients: product.ingredients,
      price: product.basePrice,
    }));

    const cartForAi = cartProducts.map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description,
      category: product.categoryName,
      type: detectProductType(product),
      ingredients: product.ingredients,
      price: product.basePrice,
      quantity: product.quantity || 1,
    }));

    const prompt = `
Ești un modul AI pentru recomandări într-o aplicație web de comandă pizza.

Primești:
- produsele deja aflate în coș;
- lista de produse disponibile care NU sunt în coș.

Regulă de context:
${allowedRule}

Sarcina ta:
1. Recomandă maximum 3 produse complementare.
2. Nu recomanda produse care sunt deja în coș.
3. Alege DOAR produse existente în lista "Produse candidate".
4. Copiază exact id-ul produsului recomandat.
5. Răspunde în limba română.
6. Returnează strict JSON valid, fără markdown.
7. Nu inventa produse, id-uri sau prețuri.
8. Nu recomanda sosuri lângă deserturi, decât dacă există și pizza în coș.
9. Folosește un ton comercial, curat și atractiv.

Produse în coș:
${JSON.stringify(cartForAi, null, 2)}

Produse candidate:
${JSON.stringify(menuForAi, null, 2)}

Schema JSON obligatorie:
{
  "summary": "explicație scurtă, comercială și clară despre recomandări",
  "recommendations": [
    {
      "productId": "id exact din lista de produse candidate",
      "type": "sos | bautura | desert | pizza | extra",
      "badge": "text scurt pentru badge",
      "matchScore": 88,
      "reason": "motiv scurt, atractiv și relevant în română"
    }
  ]
}
`;

    const aiClient = new AIClient({ apiKey: aiApiKey });

    const response = await aiClient.responses.create({
      model:
        process.env.AI_CART_MODEL ||
        
        "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const rawText = response.output_text || "";
    const aiResult = extractJsonFromText(rawText);

    return sanitizeAiRecommendations(aiResult, candidates, fallback, cartContext);
  } catch (error) {
    console.error("AI CART RECOMMENDATIONS ERROR:", error);

    return {
      ...fallback,
      source: "fallback_ai_error",
    };
  }
}

export async function POST(req) {
  try {
    const databaseReady = await connectToDatabase();

    const body = await req.json();

    const cartProductsInput = Array.isArray(body.cartProducts)
      ? body.cartProducts
      : [];

    if (cartProductsInput.length === 0) {
      return NextResponse.json({
        summary: "Coșul este gol.",
        recommendations: [],
        aiUsed: false,
        source: "empty_cart",
      });
    }

    const groupedCart = groupCartProducts(cartProductsInput);

    if (groupedCart.length === 0) {
      return NextResponse.json({
        summary: "Produsele din coș nu sunt valide.",
        recommendations: [],
        aiUsed: false,
        source: "invalid_cart",
      });
    }

    let allMenuItems = [];

    if (databaseReady) {
      const [menuItemsRaw, categoriesRaw, ingredientsRaw] = await Promise.all([
        mongoose.connection.collection("menuitems").find({ available: { $ne: false } }).toArray(),
        mongoose.connection.collection("categories").find({}).toArray(),
        mongoose.connection.collection("ingredients").find({}).toArray(),
      ]);

      const categoryMap = new Map(
        categoriesRaw.map((category) => [idToString(category._id), category])
      );

      const ingredientMap = new Map(
        ingredientsRaw.map((ingredient) => [
          idToString(ingredient._id),
          ingredient,
        ])
      );

      allMenuItems = menuItemsRaw.map((item) =>
        serializeMenuItem(item, categoryMap, ingredientMap)
      );
    }

    const cartIds = new Set(groupedCart.map((item) => item.productId));

    const cartProducts = groupedCart
      .map((groupedProduct) => {
        const dbProduct = allMenuItems.find(
          (item) => item._id === groupedProduct.productId
        );

        if (dbProduct) {
          return {
            ...dbProduct,
            quantity: groupedProduct.quantity,
          };
        }

        const fallbackProduct = groupedProduct.fallbackProduct || {};

        return {
          _id: groupedProduct.productId,
          name: fallbackProduct.name || "",
          description: fallbackProduct.description || "",
          image: fallbackProduct.image || "/pizza.png",
          basePrice: Number(fallbackProduct.basePrice || 0),
          categoryName:
            typeof fallbackProduct.category === "object"
              ? fallbackProduct.category?.name || ""
              : "",
          ingredients: [],
          quantity: groupedProduct.quantity,
        };
      })
      .filter((product) => product.name);

    const cartContext = getCartContext(cartProducts);

    const candidates = allMenuItems
      .filter((product) => !cartIds.has(product._id))
      .filter((product) => isRecommendationCandidate(product, cartContext));

    const recommendationResult = await generateAiRecommendations(
      cartProducts,
      candidates
    );

    return NextResponse.json(recommendationResult);
  } catch (error) {
    console.error("CART RECOMMENDATIONS ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la generarea recomandărilor.",
      },
      { status: 500 }
    );
  }
}