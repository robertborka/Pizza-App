import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
}

function getAddressValue(address, keys) {
  for (const key of keys) {
    if (address?.[key]) {
      return address[key];
    }
  }

  return "";
}

function buildSuggestion(item) {
  const address = item.address || {};

  const road = getAddressValue(address, [
    "road",
    "pedestrian",
    "footway",
    "path",
    "residential",
    "street",
  ]);

  const houseNumber = getAddressValue(address, ["house_number"]);
  const city = getAddressValue(address, [
    "city",
    "town",
    "municipality",
    "village",
  ]);

  const county = getAddressValue(address, ["county", "state"]);
  const postcode = getAddressValue(address, ["postcode"]);

  const primaryParts = [];

  if (road) {
    primaryParts.push(road);
  }

  if (houseNumber) {
    primaryParts.push(houseNumber);
  }

  const primary = primaryParts.join(" ").trim() || item.name || item.display_name;

  const secondaryParts = [];

  if (city) {
    secondaryParts.push(city);
  }

  if (county && county !== city) {
    secondaryParts.push(county);
  }

  if (postcode) {
    secondaryParts.push(postcode);
  }

  const secondary = secondaryParts.join(", ");

  return {
    id: String(item.place_id || item.osm_id || item.display_name),
    label: primary,
    secondary,
    fullAddress: item.display_name || primary,
    lat: item.lat || "",
    lon: item.lon || "",
    type: item.type || "",
    class: item.class || "",
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const query = cleanText(searchParams.get("q"));
    const city = cleanText(searchParams.get("city")) || "Brașov";

    if (query.length < 3) {
      return NextResponse.json({
        suggestions: [],
      });
    }

    const userAgent =
      cleanText(process.env.NOMINATIM_USER_AGENT) || "TopFamilyPizza/1.0";

    const email = cleanText(process.env.NOMINATIM_EMAIL);

    const fullQuery = [query, city, "România"]
      .filter(Boolean)
      .join(", ");

    const params = new URLSearchParams({
      format: "jsonv2",
      q: fullQuery,
      addressdetails: "1",
      limit: "6",
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

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Nu am putut căuta adresa.",
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    const suggestions = Array.isArray(data)
      ? data.map(buildSuggestion).filter((item) => item.label)
      : [];

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    console.error("ADDRESS AUTOCOMPLETE ERROR:", error);

    return NextResponse.json(
      {
        error: "A apărut o eroare la autocomplete-ul adresei.",
      },
      { status: 500 }
    );
  }
}