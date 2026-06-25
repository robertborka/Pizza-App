import AIClient from "openai";

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

function isCategory(product, categoryKeyword) {
  const category = normalizeText(product.categoryName);
  return category.includes(categoryKeyword);
}

function scoreCandidate(product, cartText, wantedType) {
  const text = getProductText(product);
  let score = 0;

  if (wantedType === "sos" && isCategory(product, "sos")) {
    score += 100;
  }

  if (
    wantedType === "bautura" &&
    (isCategory(product, "baut") || isCategory(product, "băut"))
  ) {
    score += 100;
  }

  if (wantedType === "desert" && isCategory(product, "desert")) {
    score += 100;
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

function pickBestCandidate(candidates, cartText, wantedType, usedIds) {
  return candidates
    .filter((product) => !usedIds.has(product._id))
    .map((product) => ({
      product,
      score: scoreCandidate(product, cartText, wantedType),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.product;
}

export function createFallbackCartRecommendations({ cartProducts, candidates }) {
  const cartText = normalizeText(
    cartProducts.map((product) => getProductText(product)).join(" ")
  );

  const usedIds = new Set();
  const recommendations = [];

  const sauce = pickBestCandidate(candidates, cartText, "sos", usedIds);

  if (sauce) {
    usedIds.add(sauce._id);

    recommendations.push({
      product: sauce,
      type: "sos",
      badge: "Sos potrivit",
      matchScore: 87,
      reason:
        "Un sos completează bine pizza aleasă și face comanda mai echilibrată.",
    });
  }

  const drink = pickBestCandidate(candidates, cartText, "bautura", usedIds);

  if (drink) {
    usedIds.add(drink._id);

    recommendations.push({
      product: drink,
      type: "bautura",
      badge: "Băutură recomandată",
      matchScore: 84,
      reason:
        "O băutură rece se potrivește bine cu produsele din coș, mai ales pentru pizza intensă sau picantă.",
    });
  }

  const dessert = pickBestCandidate(candidates, cartText, "desert", usedIds);

  if (dessert) {
    usedIds.add(dessert._id);

    recommendations.push({
      product: dessert,
      type: "desert",
      badge: "Desert recomandat",
      matchScore: 81,
      reason:
        "Un desert completează comanda și oferă o variantă dulce după pizza.",
    });
  }

  if (recommendations.length === 0) {
    const fallbackProducts = candidates.slice(0, 3);

    for (const product of fallbackProducts) {
      recommendations.push({
        product,
        type: "extra",
        badge: "Recomandare",
        matchScore: 72,
        reason:
          "Produs recomandat automat pe baza produselor disponibile în meniu.",
      });
    }
  }

  return {
    summary:
      "Recomandări generate automat pe baza produselor din coș și a meniului disponibil.",
    recommendations,
    aiUsed: false,
    source: "fallback",
  };
}

function sanitizeAiRecommendations({ aiResult, candidates, fallback }) {
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

    usedIds.add(productId);

    recommendations.push({
      product,
      type: String(item.type || "extra"),
      badge: String(item.badge || "Recomandare AI"),
      matchScore: clampScore(item.matchScore),
      reason: String(
        item.reason ||
          "Produs recomandat de AI pe baza produselor existente în coș."
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

export async function generateCartRecommendationsWithAi({
  cartProducts,
  candidates,
}) {
  const fallback = createFallbackCartRecommendations({
    cartProducts,
    candidates,
  });

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

  try {
    const aiClient = new AIClient({
      apiKey: aiApiKey,
    });

    const menuForAi = candidates.slice(0, 40).map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description,
      category: product.categoryName,
      ingredients: product.ingredients,
      price: product.basePrice,
    }));

    const cartForAi = cartProducts.map((product) => ({
      id: product._id,
      name: product.name,
      description: product.description,
      category: product.categoryName,
      ingredients: product.ingredients,
      price: product.basePrice,
      quantity: product.quantity || 1,
    }));

    const prompt = `
Ești un modul AI pentru recomandări într-o aplicație web de comandă pizza.

Primești:
- produsele deja aflate în coș;
- lista de produse disponibile care NU sunt în coș.

Sarcina ta:
1. Recomandă maximum 3 produse complementare.
2. Ideal recomandă: un sos, o băutură și un desert, dacă există.
3. Nu recomanda produse care sunt deja în coș.
4. Alege DOAR produse existente în lista "Produse candidate".
5. Copiază exact id-ul produsului recomandat.
6. Răspunde în limba română.
7. Returnează strict JSON valid, fără markdown.

Reguli:
- Pentru pizza picantă recomandă băutură rece și sos echilibrant, de exemplu usturoi/ranch dacă există.
- Pentru pizza cu brânză recomandă un sos mai intens sau o băutură simplă.
- Pentru comenzi cu pizza recomandă desert doar dacă există deserturi în lista de candidate.
- Nu inventa produse, id-uri sau prețuri.

Produse în coș:
${JSON.stringify(cartForAi, null, 2)}

Produse candidate:
${JSON.stringify(menuForAi, null, 2)}

Schema JSON obligatorie:
{
  "summary": "explicație scurtă despre recomandări",
  "recommendations": [
    {
      "productId": "id exact din lista de produse candidate",
      "type": "sos | bautura | desert | extra",
      "badge": "text scurt pentru badge",
      "matchScore": 88,
      "reason": "motiv scurt în română"
    }
  ]
}
`;

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

    return sanitizeAiRecommendations({
      aiResult,
      candidates,
      fallback,
    });
  } catch (error) {
    console.error("AI CART RECOMMENDATIONS ERROR:", error);

    return {
      ...fallback,
      source: "fallback_ai_error",
    };
  }
}