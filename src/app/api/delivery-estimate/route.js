import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

export const dynamic = "force-dynamic";

const DEFAULT_PREPARATION_MINUTES = Number(
  process.env.DEFAULT_PREPARATION_MINUTES || 20
);

const DEFAULT_DELIVERY_BUFFER_MINUTES = Number(
  process.env.DEFAULT_DELIVERY_BUFFER_MINUTES || 5
);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanOptionalField(value) {
  const text = cleanText(value);

  if (
    !text ||
    text === "-" ||
    text === "_" ||
    text.toLowerCase() === "null" ||
    text.toLowerCase() === "undefined"
  ) {
    return "";
  }

  return text;
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

function normalizeHouseNumber(value) {
  return cleanText(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeStreetName(value) {
  let street = cleanText(value);

  street = street.replace(/\s+/g, " ");
  street = street.replace(/\bstr\.\b/gi, "Strada");
  street = street.replace(/\bstrada\b/gi, "Strada");

  return street.trim();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

function roundNumber(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function getOriginFromRequest(req) {
  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
  }
}

async function getCurrentUser(req, databaseReady) {
  if (!databaseReady) {
    return null;
  }

  const token = await getToken({
    req,
    secret:
      process.env.NEXTAUTH_SECRET ||
      "top-family-pizza-development-secret-change-before-production",
  });

  if (!token?.email) {
    return null;
  }

  const email = normalizeEmail(token.email);
  const user = await mongoose.connection.collection("users").findOne({ email });

  return {
    email,
    admin: Boolean(user?.admin),
  };
}

async function connectToDatabase() {
  if (!hasDatabaseConfig()) {
    return false;
  }

  await tryConnectToDatabase();
  return true;
}

function buildDisplayAddressFromParts({
  address,
  street,
  streetNumber,
  building,
  entrance,
  floor,
  apartment,
}) {
  const cleanStreet = normalizeStreetName(street);
  const cleanStreetNumber = normalizeHouseNumber(streetNumber);

  const streetLine = [cleanStreet, cleanStreetNumber].filter(Boolean).join(" ");

  const extraParts = [];

  const cleanBuilding = cleanOptionalField(building);
  const cleanEntrance = cleanOptionalField(entrance);
  const cleanFloor = cleanOptionalField(floor);
  const cleanApartment = cleanOptionalField(apartment);

  if (cleanBuilding) {
    extraParts.push(`Bloc ${cleanBuilding}`);
  }

  if (cleanEntrance) {
    extraParts.push(`Scara ${cleanEntrance}`);
  }

  if (cleanFloor) {
    extraParts.push(`Etaj ${cleanFloor}`);
  }

  if (cleanApartment) {
    extraParts.push(`Ap. ${cleanApartment}`);
  }

  const builtAddress = [streetLine, ...extraParts].filter(Boolean).join(", ");

  if (builtAddress) {
    return builtAddress;
  }

  return cleanText(address);
}

function removeApartmentDetails(address) {
  let cleanAddress = cleanText(address);

  cleanAddress = cleanAddress.replace(/,\s*Bloc\s*[-\w\d]*/gi, "");
  cleanAddress = cleanAddress.replace(/,\s*Scara\s*[-\w\d]*/gi, "");
  cleanAddress = cleanAddress.replace(/,\s*Scară\s*[-\w\d]*/gi, "");
  cleanAddress = cleanAddress.replace(/,\s*Etaj\s*[-\w\d]*/gi, "");
  cleanAddress = cleanAddress.replace(/,\s*Ap\.\s*[-\w\d]*/gi, "");
  cleanAddress = cleanAddress.replace(/,\s*Apartament\s*[-\w\d]*/gi, "");

  cleanAddress = cleanAddress.replace(/\s+/g, " ");
  cleanAddress = cleanAddress.replace(/\s*,\s*,+/g, ", ");
  cleanAddress = cleanAddress.replace(/^,\s*/, "");
  cleanAddress = cleanAddress.replace(/,\s*$/, "");

  return cleanAddress.trim();
}

function extractStreetAndNumberFromAddress(address) {
  const cleanAddress = removeApartmentDetails(address);

  const firstPart = cleanAddress.split(",")[0]?.trim() || cleanAddress;

  const match = firstPart.match(/^(.+?)\s+(\d+[A-Za-z]?)$/);

  if (!match) {
    return {
      street: normalizeStreetName(firstPart),
      streetNumber: "",
    };
  }

  return {
    street: normalizeStreetName(match[1]),
    streetNumber: normalizeHouseNumber(match[2]),
  };
}

function buildCustomerAddressData(body) {
  const city = cleanText(body.city) || "Brașov";
  const country = cleanText(body.country) || "România";

  const extracted = extractStreetAndNumberFromAddress(body.address);

  const street = normalizeStreetName(body.street || extracted.street);
  const streetNumber = normalizeHouseNumber(
    body.streetNumber || extracted.streetNumber
  );

  const building = cleanOptionalField(body.building);
  const entrance = cleanOptionalField(body.entrance);
  const floor = cleanOptionalField(body.floor);
  const apartment = cleanOptionalField(body.apartment);

  const displayAddress = buildDisplayAddressFromParts({
    address: body.address,
    street,
    streetNumber,
    building,
    entrance,
    floor,
    apartment,
  });

  const geocodeAddress = [street, streetNumber].filter(Boolean).join(" ");

  return {
    city,
    country,
    street,
    streetNumber,
    building,
    entrance,
    floor,
    apartment,
    displayAddress,
    geocodeAddress,
  };
}

function buildGeocodeQueries(addressData) {
  const queries = [];

  if (addressData.geocodeAddress) {
    queries.push(
      `${addressData.geocodeAddress}, ${addressData.city}, ${addressData.country}`
    );
  }

  if (addressData.street) {
    queries.push(`${addressData.street}, ${addressData.city}, ${addressData.country}`);
  }

  const cleanedDisplayAddress = removeApartmentDetails(addressData.displayAddress);

  if (cleanedDisplayAddress) {
    queries.push(
      `${cleanedDisplayAddress}, ${addressData.city}, ${addressData.country}`
    );
  }

  return [...new Set(queries.map(cleanText).filter(Boolean))];
}

function getAddressValue(address, keys) {
  for (const key of keys) {
    if (address?.[key]) {
      return address[key];
    }
  }

  return "";
}

function isGoodGeocodeResult(result, addressData, queryIndex) {
  if (!result) {
    return false;
  }

  if (queryIndex > 0) {
    return true;
  }

  if (!addressData.streetNumber) {
    return true;
  }

  const address = result.address || {};
  const foundHouseNumber = normalizeHouseNumber(address.house_number);

  if (!foundHouseNumber) {
    return false;
  }

  return foundHouseNumber === addressData.streetNumber;
}

function buildFallbackResult(result, addressData) {
  const address = result.address || {};

  const road = getAddressValue(address, [
    "road",
    "pedestrian",
    "footway",
    "path",
    "residential",
    "street",
  ]);

  const city = getAddressValue(address, [
    "city",
    "town",
    "municipality",
    "village",
  ]);

  return {
    ...result,
    approximate: true,
    approximationReason: addressData.streetNumber
      ? `Numărul ${addressData.streetNumber} nu a fost găsit exact, estimarea este calculată pe strada ${road || addressData.street}.`
      : "Adresa exactă nu a fost găsită, estimarea este calculată pe strada introdusă.",
    display_name:
      result.display_name ||
      `${road || addressData.street}, ${city || addressData.city}, ${
        addressData.country
      }`,
  };
}

async function geocodeAddressWithNominatim(query) {
  const userAgent =
    cleanText(process.env.NOMINATIM_USER_AGENT) || "TopFamilyPizza/1.0";

  const email = cleanText(process.env.NOMINATIM_EMAIL);

  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    addressdetails: "1",
    limit: "5",
    countrycodes: "ro",
    dedupe: "1",
  });

  if (email) {
    params.set("email", email);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "ro",
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data;
}

async function geocodeCustomerAddress(addressData) {
  const queries = buildGeocodeQueries(addressData);

  let firstAvailableResult = null;

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    const results = await geocodeAddressWithNominatim(query);

    if (results.length > 0 && !firstAvailableResult) {
      firstAvailableResult = results[0];
    }

    const exactResult = results.find((result) =>
      isGoodGeocodeResult(result, addressData, index)
    );

    if (exactResult) {
      return {
        result: index === 0 ? exactResult : buildFallbackResult(exactResult, addressData),
        query,
        approximate: index !== 0,
      };
    }
  }

  if (firstAvailableResult) {
    return {
      result: buildFallbackResult(firstAvailableResult, addressData),
      query: queries[0],
      approximate: true,
    };
  }

  return {
    result: null,
    query: queries[0] || "",
    approximate: false,
  };
}

async function geocodeSimpleAddress(address) {
  const query = cleanText(address);

  if (!query) {
    return null;
  }

  const results = await geocodeAddressWithNominatim(query);

  if (!results.length) {
    return null;
  }

  return results[0];
}

async function getRouteFromOsrm({ restaurant, customer }) {
  const restaurantLon = restaurant.lon;
  const restaurantLat = restaurant.lat;
  const customerLon = customer.lon;
  const customerLat = customer.lat;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${restaurantLon},${restaurantLat};${customerLon},${customerLat}` +
    `?overview=full&geometries=geojson`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nu am putut calcula ruta de livrare.");
  }

  const data = await response.json();

  const route = data.routes?.[0];

  if (!route) {
    throw new Error("Nu există rută disponibilă pentru adresa introdusă.");
  }

  const coordinates = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
    : [];

  return {
    coordinates,
    distanceMeters: route.distance || 0,
    durationSeconds: route.duration || 0,
  };
}

function buildFallbackPrediction({ drivingMinutes, distanceKm, products }) {
  const safeProducts = Array.isArray(products) ? products : [];

  const totalQuantity = safeProducts.reduce((sum, product) => {
    return sum + Number(product.quantity || 1);
  }, 0);

  const pizzaCount = safeProducts.reduce((sum, product) => {
    const text = normalizeText(`${product.name || ""} ${product.category || ""}`);

    if (text.includes("pizza")) {
      return sum + Number(product.quantity || 1);
    }

    return sum;
  }, 0);

  const dessertCount = safeProducts.reduce((sum, product) => {
    const text = normalizeText(`${product.name || ""} ${product.category || ""}`);

    if (
      text.includes("desert") ||
      text.includes("clatite") ||
      text.includes("papanasi") ||
      text.includes("tiramisu")
    ) {
      return sum + Number(product.quantity || 1);
    }

    return sum;
  }, 0);

  let preparationMinutes = DEFAULT_PREPARATION_MINUTES;

  preparationMinutes += pizzaCount * 4;
  preparationMinutes += dessertCount * 2;

  if (totalQuantity >= 4) {
    preparationMinutes += 5;
  }

  if (totalQuantity >= 7) {
    preparationMinutes += 8;
  }

  let deliveryBufferMinutes = DEFAULT_DELIVERY_BUFFER_MINUTES;

  if (distanceKm > 3) {
    deliveryBufferMinutes += 2;
  }

  if (distanceKm > 6) {
    deliveryBufferMinutes += 4;
  }

  if (distanceKm > 10) {
    deliveryBufferMinutes += 6;
  }

  const estimatedDeliveryMinutes =
    preparationMinutes + drivingMinutes + deliveryBufferMinutes;

  let riskLevel = "low";

  if (estimatedDeliveryMinutes >= 40) {
    riskLevel = "medium";
  }

  if (estimatedDeliveryMinutes >= 55) {
    riskLevel = "high";
  }

  return {
    preparationMinutes,
    deliveryBufferMinutes,
    estimatedDeliveryMinutes,
    riskLevel,
    reason:
      "Estimarea a fost calculată automat pe baza distanței, timpului de drum și produselor comandate.",
    factors: [
      `Distanță estimată: ${distanceKm} km`,
      `Timp estimat pe drum: ${drivingMinutes} minute`,
      `Produse analizate: ${totalQuantity}`,
    ],
    aiUsed: false,
    source: "fallback",
  };
}

async function getAiDeliveryPrediction({
  req,
  distanceKm,
  drivingMinutes,
  products,
  totalPrice,
  city,
  notes,
  customerAddress,
  restaurantAddress,
}) {
  const fallback = buildFallbackPrediction({
    drivingMinutes,
    distanceKm,
    products,
  });

  try {
    const origin = getOriginFromRequest(req);

    const response = await fetch(`${origin}/api/ai/delivery-prediction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        distanceKm,
        drivingMinutes,
        products,
        totalPrice,
        city,
        notes,
        customerAddress,
        restaurantAddress,
        orderCreatedAt: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();

    if (!data?.prediction) {
      return fallback;
    }

    return data.prediction;
  } catch (error) {
    console.error("DELIVERY AI PREDICTION CALL ERROR:", error);

    return fallback;
  }
}

async function saveDeliveryEstimateToOrder({ orderId, deliveryEstimate, databaseReady, currentUser }) {
  if (!databaseReady || !orderId || !mongoose.Types.ObjectId.isValid(orderId) || !currentUser?.email) {
    return;
  }

  const query = currentUser.admin
    ? { _id: new mongoose.Types.ObjectId(orderId) }
    : { _id: new mongoose.Types.ObjectId(orderId), userEmail: currentUser.email };

  await mongoose.connection.collection("orders").updateOne(
    query,
    {
      $set: {
        deliveryEstimate,
        updatedAt: new Date(),
      },
    }
  );
}

export async function POST(req) {
  try {
    const databaseReady = await connectToDatabase();

    const body = await req.json();
    const currentUser = await getCurrentUser(req, databaseReady);

    const restaurantAddress =
      cleanText(process.env.RESTAURANT_ADDRESS) ||
      "Strada Rozelor 36B, Brașov, România";

    const addressData = buildCustomerAddressData(body);

    const customerGeocode = await geocodeCustomerAddress(addressData);

    if (!customerGeocode.result) {
      return NextResponse.json(
        {
          error: `Nu am putut găsi coordonatele pentru adresa: ${addressData.geocodeAddress}, ${addressData.city}, ${addressData.country}`,
        },
        { status: 400 }
      );
    }

    const restaurantGeocode = await geocodeSimpleAddress(restaurantAddress);

    if (!restaurantGeocode) {
      return NextResponse.json(
        {
          error: `Nu am putut găsi coordonatele restaurantului: ${restaurantAddress}`,
        },
        { status: 400 }
      );
    }

    const restaurant = {
      lat: safeNumber(restaurantGeocode.lat),
      lon: safeNumber(restaurantGeocode.lon),
      lng: safeNumber(restaurantGeocode.lon),
      displayName: restaurantGeocode.display_name || restaurantAddress,
      address: restaurantAddress,
    };

    const customer = {
      lat: safeNumber(customerGeocode.result.lat),
      lon: safeNumber(customerGeocode.result.lon),
      lng: safeNumber(customerGeocode.result.lon),
      displayName: customerGeocode.result.display_name || addressData.displayAddress,
      address: addressData.displayAddress,
      geocodeAddress: `${addressData.geocodeAddress}, ${addressData.city}, ${addressData.country}`,
      approximate: Boolean(customerGeocode.result.approximate),
      approximationReason: customerGeocode.result.approximationReason || "",
    };

    const osrmRoute = await getRouteFromOsrm({
      restaurant,
      customer,
    });

    const distanceKm = roundNumber(osrmRoute.distanceMeters / 1000, 1);
    const drivingMinutes = Math.max(
      1,
      Math.round(osrmRoute.durationSeconds / 60)
    );

    const products = Array.isArray(body.products) ? body.products : [];
    const totalPrice = safeNumber(body.totalPrice, 0);

    const aiPrediction = await getAiDeliveryPrediction({
      req,
      distanceKm,
      drivingMinutes,
      products,
      totalPrice,
      city: addressData.city,
      notes: cleanText(body.notes),
      customerAddress: addressData.displayAddress,
      restaurantAddress,
    });

    const preparationMinutes = safeNumber(
      aiPrediction.preparationMinutes,
      DEFAULT_PREPARATION_MINUTES
    );

    const deliveryBufferMinutes = safeNumber(
      aiPrediction.deliveryBufferMinutes,
      DEFAULT_DELIVERY_BUFFER_MINUTES
    );

    const estimatedDeliveryMinutes = safeNumber(
      aiPrediction.estimatedDeliveryMinutes,
      preparationMinutes + drivingMinutes + deliveryBufferMinutes
    );

    const estimatedArrival = new Date(
      Date.now() + estimatedDeliveryMinutes * 60 * 1000
    ).toISOString();

    const deliveryEstimate = {
      orderId: cleanText(body.orderId),
      restaurant,
      customer,
      route: osrmRoute.coordinates,
      distanceKm,
      drivingMinutes,
      preparationMinutes,
      deliveryBufferMinutes,
      estimatedDeliveryMinutes,
      estimatedArrival,
      aiPrediction: {
        ...aiPrediction,
        preparationMinutes,
        deliveryBufferMinutes,
        estimatedDeliveryMinutes,
      },
      geocoding: {
        approximate: Boolean(customer.approximate),
        queryUsed: customerGeocode.query,
        note: customer.approximationReason,
      },
      createdAt: new Date().toISOString(),
    };

    await saveDeliveryEstimateToOrder({
      orderId: body.orderId,
      deliveryEstimate,
      databaseReady,
      currentUser,
    });

    return NextResponse.json(deliveryEstimate);
  } catch (error) {
    console.error("DELIVERY ESTIMATE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error.message || "A apărut o eroare la calcularea estimării de livrare.",
      },
      { status: 500 }
    );
  }
}