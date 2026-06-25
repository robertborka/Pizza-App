import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { User } from "@/app/models/user";
import { connectToDatabase, isMissingDatabaseConfigError } from "@/libs/mongoose";

export const dynamic = "force-dynamic";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function buildFullAddress(user) {
  const streetLine = [user.street, user.streetNumber]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(" ");

  const extraParts = [];

  if (cleanText(user.building)) {
    extraParts.push(`Bloc ${cleanText(user.building)}`);
  }

  if (cleanText(user.entrance)) {
    extraParts.push(`Scara ${cleanText(user.entrance)}`);
  }

  if (cleanText(user.floor)) {
    extraParts.push(`Etaj ${cleanText(user.floor)}`);
  }

  if (cleanText(user.apartment)) {
    extraParts.push(`Ap. ${cleanText(user.apartment)}`);
  }

  return [streetLine, ...extraParts].filter(Boolean).join(", ");
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    _id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    image: user.image || "",
    admin: Boolean(user.admin),

    phone: user.phone || "",
    city: user.city || "Brașov",
    street: user.street || "",
    streetNumber: user.streetNumber || "",
    building: user.building || "",
    entrance: user.entrance || "",
    floor: user.floor || "",
    apartment: user.apartment || "",
    defaultNotes: user.defaultNotes || "",

    fullAddress: buildFullAddress(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getCurrentUser(req) {
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

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      name: token.name || "",
      image: token.image || token.picture || "",
    });
  }

  return user;
}

export async function GET(req) {
  try {
    await connectToDatabase();

    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json(
        {
          error: "Nu ești autentificat.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(serializeUser(user));
  } catch (error) {
    console.error("PROFILE GET ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        {
          error: "Serviciul de profil nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la încărcarea profilului.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await connectToDatabase();

    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json(
        {
          error: "Nu ești autentificat.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const updateData = {
      name: cleanText(body.name),
      phone: cleanText(body.phone),
      city: cleanText(body.city) || "Brașov",
      street: cleanText(body.street),
      streetNumber: cleanText(body.streetNumber),
      building: cleanText(body.building),
      entrance: cleanText(body.entrance),
      floor: cleanText(body.floor),
      apartment: cleanText(body.apartment),
      defaultNotes: cleanText(body.defaultNotes),
    };

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: updateData,
      },
      {
        new: true,
      }
    );

    return NextResponse.json({
      message: "Profilul a fost actualizat cu succes.",
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error("PROFILE PUT ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return NextResponse.json(
        {
          error: "Serviciul de profil nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "A apărut o eroare la salvarea profilului.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  return PUT(req);
}