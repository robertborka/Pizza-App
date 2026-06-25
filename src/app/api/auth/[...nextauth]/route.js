import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { User } from "@/app/models/user";
import { hasDatabaseConfig, tryConnectToDatabase } from "@/libs/mongoose";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hasGoogleConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function findUserByEmail(email) {
  if (!hasDatabaseConfig()) {
    return null;
  }

  await tryConnectToDatabase();
  return User.findOne({ email });
}

const providers = [
  CredentialsProvider({
    name: "Email și parolă",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Parolă", type: "password" },
    },
    async authorize(credentials) {
      const email = normalizeEmail(credentials?.email);
      const password = credentials?.password;

      if (!email || !password || !hasDatabaseConfig()) {
        return null;
      }

      const user = await findUserByEmail(email);

      if (!user || !user.password) {
        return null;
      }

      const passwordOk = await bcrypt.compare(password, user.password);

      if (!passwordOk) {
        return null;
      }

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name || "",
        image: user.image || "",
        admin: Boolean(user.admin),
      };
    },
  }),
];

if (hasGoogleConfig()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    })
  );
}

export const authOptions = {
  secret:
    process.env.NEXTAUTH_SECRET ||
    "top-family-pizza-development-secret-change-before-production",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      if (!hasDatabaseConfig()) {
        return false;
      }

      await tryConnectToDatabase();

      const email = normalizeEmail(user.email);

      if (!email) {
        return false;
      }

      let existingUser = await User.findOne({ email });

      if (!existingUser) {
        existingUser = await User.create({
          email,
          name: user.name || profile?.name || "",
          image: user.image || profile?.picture || "",
          googleId: account.providerAccountId,
          admin: false,
        });
      } else {
        existingUser.name = existingUser.name || user.name || profile?.name || "";
        existingUser.image =
          existingUser.image || user.image || profile?.picture || "";
        existingUser.googleId =
          existingUser.googleId || account.providerAccountId || "";

        await existingUser.save();
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      const email = normalizeEmail(user?.email || token?.email);

      if (!email) {
        return token;
      }

      if (user) {
        token.id = user.id || token.id;
        token.email = user.email || token.email;
        token.name = user.name || token.name || "";
        token.image = user.image || token.image || "";
        token.admin = Boolean(user.admin);
      }

      if (trigger === "update" && session) {
        if (session.name !== undefined) {
          token.name = session.name;
        }

        if (session.image !== undefined) {
          token.image = session.image;
        }

        if (session.admin !== undefined) {
          token.admin = session.admin;
        }
      }

      if (!hasDatabaseConfig()) {
        return token;
      }

      const dbUser = await findUserByEmail(email);

      if (dbUser) {
        token.id = dbUser._id.toString();
        token.email = dbUser.email;
        token.name = dbUser.name || "";
        token.image = dbUser.image || "";
        token.admin = Boolean(dbUser.admin);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || "";
        session.user.email = token.email || "";
        session.user.name = token.name || "";
        session.user.image = token.image || "";
        session.user.admin = Boolean(token.admin);
      }

      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
