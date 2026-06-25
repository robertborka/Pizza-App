import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
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

function getAddressValue(address, keys) {
  for (const key of keys) {
    if (address?.[key]) {
      return address[key];
    }
  }

  return "";
}

function normalizeStreetName(value) {
  let street = cleanText(value);

  street = street.replace(/\s+/g, " ");
  street = street.replace(/\bstr\.\b/gi, "Strada");
  street = street.replace(/\bstrada\b/gi, "Strada");

  return street.trim();
}

function buildManualSuggestion(query, city) {
  const street = normalizeStreetName(query);
  const cleanCity = cleanText(city) || "Brașov";

  return {
    id: `manual-${normalizeText(`${street}-${cleanCity}`)}`,
    provider: "manual",
    label: street,
    secondary: `Stradă introdusă manual • ${cleanCity}`,
    fullStreet: street,
    fullAddress: `${street}, ${cleanCity}, România`,
    lat: "",
    lon: "",
    exact: false,
  };
}

function buildNominatimSuggestion(item, city) {
  const address = item.address || {};

  const road = getAddressValue(address, [
    "road",
    "pedestrian",
    "footway",
    "path",
    "residential",
    "street",
  ]);

  const cityName =
    getAddressValue(address, ["city", "town", "municipality", "village"]) ||
    city ||
    "Brașov";

  const postcode = getAddressValue(address, ["postcode"]);
  const county = getAddressValue(address, ["county", "state"]);

  const streetName = normalizeStreetName(road || item.name || "");

  if (!streetName) {
    return null;
  }

  const secondaryParts = [];

  if (cityName) {
    secondaryParts.push(cityName);
  }

  if (postcode) {
    secondaryParts.push(postcode);
  }

  if (county && county !== cityName) {
    secondaryParts.push(county);
  }

  return {
    id: String(item.place_id || item.osm_id || item.display_name),
    provider: "osm",
    label: streetName,
    secondary: secondaryParts.join(", "),
    fullStreet: streetName,
    fullAddress: item.display_name || `${streetName}, ${cityName}, România`,
    lat: item.lat || "",
    lon: item.lon || "",
    exact: true,
  };
}

function dedupeSuggestions(suggestions) {
  const seen = new Set();
  const cleanSuggestions = [];

  for (const suggestion of suggestions) {
    const key = normalizeText(suggestion.fullStreet || suggestion.label);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleanSuggestions.push(suggestion);
  }

  return cleanSuggestions;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const query = cleanText(searchParams.get("q"));
    const city = cleanText(searchParams.get("city")) || "Brașov";

    if (query.length < 2) {
      return NextResponse.json({
        suggestions: [],
        source: "empty",
      });
    }

    const suggestions = [];

    suggestions.push(buildManualSuggestion(query, city));

    const userAgent =
      cleanText(process.env.NOMINATIM_USER_AGENT) || "TopFamilyPizza/1.0";

    const email = cleanText(process.env.NOMINATIM_EMAIL);

    const fullQuery = [query, city, "România"].filter(Boolean).join(", ");

    const params = new URLSearchParams({
      format: "jsonv2",
      q: fullQuery,
      addressdetails: "1",
      limit: "7",
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
        next: {
          revalidate: 86400,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data)) {
        const osmSuggestions = data
          .map((item) => buildNominatimSuggestion(item, city))
          .filter(Boolean);

        suggestions.push(...osmSuggestions);
      }
    }

    return NextResponse.json({
      suggestions: dedupeSuggestions(suggestions).slice(0, 6),
      source: "openstreetmap_free",
    });
  } catch (error) {
    console.error("STREET AUTOCOMPLETE ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la căutarea străzii.",
      },
      { status: 500 }
    );
  }
}