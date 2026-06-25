import { User } from "@/app/models/user";
import bcrypt from "bcryptjs";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !password) {
      return Response.json(
        { error: "Emailul și parola sunt obligatorii." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Adresa de email nu este validă." },
        { status: 400 }
      );
    }

    if (password.length < 5) {
      return Response.json(
        { error: "Parola trebuie să aibă cel puțin 5 caractere." },
        { status: 400 }
      );
    }

    if (!hasDatabaseConfig()) {
      return Response.json(
        {
          error:
            "Înregistrarea nu este disponibilă momentan.",
        },
        { status: 503 }
      );
    }

    await tryConnectToDatabase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return Response.json(
        { error: "Există deja un cont cu acest email." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await User.create({
      email,
      password: hashedPassword,
      admin: false,
    });

    return Response.json(
      {
        message: "Contul a fost creat cu succes.",
        user: {
          _id: createdUser._id,
          email: createdUser.email,
          createdAt: createdUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Response.json(
        { error: "Există deja un cont cu acest email." },
        { status: 409 }
      );
    }

    console.error("REGISTER ERROR:", error);
    return Response.json(
      { error: "A apărut o eroare internă la crearea contului." },
      { status: 500 }
    );
  }
}
