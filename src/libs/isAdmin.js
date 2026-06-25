import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { User } from "@/app/models/user";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

export async function getCurrentUser() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  await tryConnectToDatabase();

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  return User.findOne({
    email: String(session.user.email).trim().toLowerCase(),
  });
}

export async function isAdmin() {
  const user = await getCurrentUser();
  return Boolean(user?.admin);
}

export async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: hasDatabaseConfig()
        ? "Trebuie să fii autentificat."
        : "Panoul de administrare nu este disponibil momentan.",
    };
  }

  if (!user.admin) {
    return {
      ok: false,
      status: 403,
      error: "Nu ai drepturi de administrator.",
    };
  }

  return {
    ok: true,
    user,
  };
}
