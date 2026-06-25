import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { User } from "@/app/models/user";
import { connectToDatabase, isMissingDatabaseConfigError } from "@/libs/mongoose";

const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function validateImageFile(file) {
  if (!file) {
    return "Nu ai selectat nicio poză.";
  }

  if (typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return "Fișier invalid.";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Poza trebuie să fie JPG, PNG sau WEBP.";
  }

  if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
    return `Poza este prea mare. Limita este ${MAX_UPLOAD_MB} MB.`;
  }

  return "";
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return Response.json({ error: "Neautorizat." }, { status: 401 });
    }

    const data = await req.formData();
    const file = data.get("file");
    const validationError = validateImageFile(file);

    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    await connectToDatabase();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = EXTENSION_BY_MIME_TYPE[file.type] || "png";
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, fileName);
    const imageUrl = `/uploads/${fileName}`;

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email.toLowerCase() },
      { image: imageUrl },
      { new: true }
    );

    if (!updatedUser) {
      return Response.json(
        { error: "Utilizatorul nu a fost găsit." },
        { status: 404 }
      );
    }

    return Response.json(
      {
        message: "Poza de profil a fost actualizată.",
        image: updatedUser.image,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("UPLOAD ERROR:", error);

    if (isMissingDatabaseConfigError(error)) {
      return Response.json(
        {
          error: "Upload-ul de profil nu este disponibil momentan.",
        },
        { status: 503 }
      );
    }

    return Response.json(
      { error: "Eroare la încărcarea pozei." },
      { status: 500 }
    );
  }
}
