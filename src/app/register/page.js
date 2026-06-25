"use client";

import Image from "next/image";
import Link from "next/link";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  const [providers, setProviders] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const googleProvider = providers?.google;

  const passwordStrength = useMemo(() => {
    if (!password) return "";
    if (password.length < 5) return "slabă";
    if (password.length < 8) return "acceptabilă";
    return "bună";
  }, [password]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 5 && !creatingUser;
  }, [email, password, creatingUser]);

  useEffect(() => {
    let ignore = false;

    async function loadProviders() {
      const availableProviders = await getProviders();

      if (!ignore) {
        setProviders(availableProviders || {});
      }
    }

    loadProviders();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  async function handleFormSubmit(ev) {
    ev.preventDefault();
    setCreatingUser(true);
    setMessage("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error || "Înregistrarea a eșuat.");
        return;
      }

      setEmail("");
      setPassword("");
      setMessageType("success");
      setMessage("Contul a fost creat. Te poți conecta cu emailul și parola introduse.");
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("A apărut o eroare de conexiune. Încearcă din nou în câteva momente.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleGoogleRegister() {
    if (!googleProvider) {
      return;
    }

    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-sm border border-orange-100 md:p-10">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="mb-8 text-center lg:text-left">
            <p className="font-bold uppercase tracking-[0.3em] text-primary text-xs">
              Cont nou
            </p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">
              Creează cont pentru comenzi rapide.
            </h1>
            <p className="mt-3 text-gray-500 leading-7">
              Completează emailul și parola. Datele de livrare pot fi salvate ulterior în profil.
            </p>
          </div>

          <form className="grid gap-4" onSubmit={handleFormSubmit}>
            <label className="grid gap-2 text-sm font-bold text-gray-700">
              Email
              <input
                type="email"
                placeholder="exemplu@email.com"
                value={email}
                disabled={creatingUser}
                autoComplete="email"
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-gray-700">
              Parolă
              <input
                type="password"
                placeholder="Minimum 5 caractere"
                value={password}
                disabled={creatingUser}
                autoComplete="new-password"
                onChange={(ev) => setPassword(ev.target.value)}
              />
              {passwordStrength && (
                <span className="text-xs font-semibold text-gray-500">
                  Putere parolă: {passwordStrength}
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full border-0 bg-primary px-8 py-3.5 font-black text-white shadow-sm shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingUser ? "Se creează contul..." : "Înregistrare"}
            </button>

            {googleProvider && (
              <>
                <div className="flex items-center gap-4 py-2 text-center text-sm font-semibold text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  sau
                  <span className="h-px flex-1 bg-gray-200" />
                </div>

                <button
                  type="button"
                  className="flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-6 py-3 font-bold text-gray-700 transition hover:border-primary hover:text-primary"
                  disabled={creatingUser}
                  onClick={handleGoogleRegister}
                >
                  <Image src="/google.png" alt="Google" width={22} height={22} />
                  Continuă cu Google
                </button>
              </>
            )}

            {message && (
              <p
                className={
                  messageType === "success"
                    ? "rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700"
                    : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700"
                }
              >
                {message}
              </p>
            )}

            <div className="rounded-2xl bg-orange-50 p-4 text-center text-sm text-gray-600 border border-orange-100">
              Ai deja cont?{" "}
              <Link className="font-black text-primary underline" href="/login">
                Conectează-te aici
              </Link>
            </div>
          </form>
        </div>

        <div className="rounded-[2rem] bg-gray-950 p-8 text-white shadow-2xl overflow-hidden relative min-h-[420px] flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(241,58,1,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.14),transparent_30%)]" />

          <div className="relative">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/80 border border-white/15">
              Flux complet
            </span>
            <h2 className="mt-6 text-4xl font-black leading-tight md:text-5xl">
              Profil, coș, comenzi și livrare într-un singur loc.
            </h2>
            <p className="mt-5 leading-7 text-white/70">
              Contul completează partea de client: autentificare, profil, istoric comenzi
              și date de livrare reutilizabile.
            </p>
          </div>

          <div className="relative grid gap-3 pt-8">
            {["Autentificare securizată", "Profil client", "Istoric comenzi"].map((item) => (
              <div key={item} className="rounded-2xl bg-white/10 p-4 border border-white/10 font-bold">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
