import { NextResponse } from "next/server";
import AIClient from "openai";

export const dynamic = "force-dynamic";


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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(number), min), max);
}

function normalizeRiskLevel(value) {
  const risk = String(value || "").toLowerCase();

  if (risk === "low" || risk === "medium" || risk === "high") {
    return risk;
  }

  return "medium";
}

function createFallbackPrediction(input) {
  const products = Array.isArray(input.products) ? input.products : [];

  const totalQuantity = products.reduce((sum, item) => {
    return sum + Number(item.quantity || 1);
  }, 0);

  const pizzaCount = products.reduce((sum, item) => {
    const text = `${item.name || ""} ${item.category || ""}`.toLowerCase();

    if (text.includes("pizza")) {
      return sum + Number(item.quantity || 1);
    }

    return sum;
  }, 0);

  const dessertCount = products.reduce((sum, item) => {
    const text = `${item.name || ""} ${item.category || ""}`.toLowerCase();

    if (
      text.includes("desert") ||
      text.includes("papana") ||
      text.includes("clatite") ||
      text.includes("clătite")
    ) {
      return sum + Number(item.quantity || 1);
    }

    return sum;
  }, 0);

  const drivingMinutes = Number(input.drivingMinutes || 0);
  const distanceKm = Number(input.distanceKm || 0);

  let preparationMinutes = 15;

  preparationMinutes += pizzaCount * 4;
  preparationMinutes += dessertCount * 3;

  if (totalQuantity >= 4) {
    preparationMinutes += 5;
  }

  if (totalQuantity >= 7) {
    preparationMinutes += 8;
  }

  let deliveryBufferMinutes = 5;

  if (distanceKm > 3) {
    deliveryBufferMinutes = 7;
  }

  if (distanceKm > 6) {
    deliveryBufferMinutes = 10;
  }

  if (distanceKm > 10) {
    deliveryBufferMinutes = 14;
  }

  const estimatedDeliveryMinutes =
    preparationMinutes + drivingMinutes + deliveryBufferMinutes;

  let riskLevel = "low";

  if (estimatedDeliveryMinutes >= 35) {
    riskLevel = "medium";
  }

  if (estimatedDeliveryMinutes >= 50) {
    riskLevel = "high";
  }

  return {
    preparationMinutes,
    deliveryBufferMinutes,
    estimatedDeliveryMinutes,
    riskLevel,
    reason:
      "Estimare calculată automat pe baza distanței, timpului de deplasare și numărului de produse din comandă.",
    factors: [
      `Distanță aproximativă: ${distanceKm} km`,
      `Timp estimat pe drum: ${drivingMinutes} minute`,
      `Număr produse: ${totalQuantity}`,
    ],
    aiUsed: false,
    source: "fallback",
  };
}

function sanitizePrediction(aiResult, fallback, input) {
  const drivingMinutes = Number(input.drivingMinutes || 0);

  const preparationMinutes = clampNumber(
    aiResult.preparationMinutes,
    10,
    60,
    fallback.preparationMinutes
  );

  const deliveryBufferMinutes = clampNumber(
    aiResult.deliveryBufferMinutes,
    0,
    30,
    fallback.deliveryBufferMinutes
  );

  let estimatedDeliveryMinutes = clampNumber(
    aiResult.estimatedDeliveryMinutes,
    10,
    120,
    preparationMinutes + drivingMinutes + deliveryBufferMinutes
  );

  const minimumTotal = preparationMinutes + drivingMinutes;

  if (estimatedDeliveryMinutes < minimumTotal) {
    estimatedDeliveryMinutes = minimumTotal + deliveryBufferMinutes;
  }

  const factors = Array.isArray(aiResult.factors)
    ? aiResult.factors.map((factor) => String(factor)).filter(Boolean)
    : fallback.factors;

  return {
    preparationMinutes,
    deliveryBufferMinutes,
    estimatedDeliveryMinutes,
    riskLevel: normalizeRiskLevel(aiResult.riskLevel),
    reason: String(aiResult.reason || fallback.reason),
    factors,
    aiUsed: true,
    source: "motor_inteligent",
  };
}

async function predictDeliveryTimeWithAi(input) {
  const fallback = createFallbackPrediction(input);

  const aiApiKey = process.env.AI_PROVIDER_API_KEY;

  if (!aiApiKey) {
    return {
      ...fallback,
      source: "reguli_interne",
    };
  }

  try {
    const prompt = `
Ești un modul AI pentru estimarea timpului de livrare într-o aplicație web de comandă pizza.

Primești:
- distanța reală dintre restaurant și client;
- timpul estimat pe traseu;
- produsele comandate;
- ora comenzii;
- orașul;
- observațiile clientului.

Trebuie să estimezi:
1. timpul de pregătire;
2. marja de livrare / trafic;
3. timpul total estimativ;
4. nivelul de risc al întârzierii;
5. o explicație scurtă în limba română;
6. factorii care au influențat estimarea.

Reguli:
- Nu modifica timpul de drum primit. Acela vine din rutare.
- Timpul total trebuie să includă pregătirea + timpul de drum + marja de livrare.
- Pentru comenzi cu mai multe pizza, crește timpul de pregătire.
- Pentru comenzi cu deserturi calde, crește ușor timpul de pregătire.
- Pentru distanțe mai mari, crește marja de livrare.
- Răspunde strict JSON valid, fără markdown.

Date primite:
${JSON.stringify(input, null, 2)}

Schema JSON obligatorie:
{
  "preparationMinutes": 24,
  "deliveryBufferMinutes": 7,
  "estimatedDeliveryMinutes": 42,
  "riskLevel": "low | medium | high",
  "reason": "explicație scurtă în română",
  "factors": ["factor 1", "factor 2", "factor 3"]
}
`;

    const aiClient = new AIClient({ apiKey: aiApiKey });

    const response = await aiClient.responses.create({
      model:
        process.env.AI_DELIVERY_MODEL ||
        
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

    if (!aiResult) {
      console.error("AI DELIVERY RAW RESPONSE:", rawText);

      return {
        ...fallback,
        source: "fallback_invalid_ai_json",
      };
    }

    return sanitizePrediction(aiResult, fallback, input);
  } catch (error) {
    console.error("AI DELIVERY PREDICTION ERROR:", error);

    return {
      ...fallback,
      source: "fallback_ai_error",
    };
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const prediction = await predictDeliveryTimeWithAi({
      distanceKm: Number(body.distanceKm || 0),
      drivingMinutes: Number(body.drivingMinutes || 0),
      products: Array.isArray(body.products) ? body.products : [],
      totalPrice: Number(body.totalPrice || 0),
      city: body.city || "",
      notes: body.notes || "",
      customerAddress: body.customerAddress || "",
      restaurantAddress: body.restaurantAddress || "",
      orderCreatedAt: body.orderCreatedAt || new Date().toISOString(),
    });

    return NextResponse.json({
      prediction,
    });
  } catch (error) {
    console.error("AI DELIVERY ROUTE ERROR:", error);

    return NextResponse.json(
      { error: "A apărut o eroare la estimarea livrării." },
      { status: 500 }
    );
  }
}