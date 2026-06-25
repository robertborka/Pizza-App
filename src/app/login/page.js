"use client";

import Image from "next/image";
import Link from "next/link";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function getFriendlyAuthError(error) {
  if (!error) {
    return "";
  }

  if (error === "OAuthSignin") {
    return "Autentificarea externă nu este configurată complet.";
  }

  if (error === "CredentialsSignin") {
    return "Email sau parolă incorectă.";
  }

  return "Nu am putut finaliza autentificarea.";
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const [providers, setProviders] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const googleProvider = providers?.google;
  const urlError = searchParams.get("error");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loggingIn;
  }, [email, password, loggingIn]);

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

  useEffect(() => {
    const friendlyError = getFriendlyAuthError(urlError);

    if (friendlyError) {
      setMessageType("error");
      setMessage(friendlyError);
    }
  }, [urlError]);

  async function handleFormSubmit(ev) {
    ev.preventDefault();
    setLoggingIn(true);
    setMessage("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessageType("error");
        setMessage("Email sau parolă incorectă. Verifică datele și încearcă din nou.");
        return;
      }

      setMessageType("success");
      setMessage("Conectare reușită. Te redirecționăm către pagina principală.");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("A apărut o eroare de conexiune. Încearcă din nou în câteva momente.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleGoogleLogin() {
    if (!googleProvider) {
      return;
    }

    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <section className="relative mt-8 overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-sm border border-orange-100 md:p-10">
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="rounded-[2rem] bg-gray-950 p-8 text-white shadow-2xl overflow-hidden relative min-h-[420px] flex flex-col justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(241,58,1,0.35),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_30%)]" />

          <div className="relative">
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/80 border border-white/15">
              Cont client
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight md:text-5xl">
              Intră în cont și continuă comanda.
            </h1>
            <p className="mt-5 max-w-md leading-7 text-white/70">
              Contul salvează datele de livrare, istoricul comenzilor și face procesul de comandă mai rapid.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3 pt-8 text-center text-sm">
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <p className="font-black text-primary">1</p>
              <p className="text-white/70">date salvate</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <p className="font-black text-primary">2</p>
              <p className="text-white/70">coș rapid</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
              <p className="font-black text-primary">3</p>
              <p className="text-white/70">istoric comenzi</p>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <p className="font-bold uppercase tracking-[0.3em] text-primary text-xs">
              Top Family Pizza
            </p>
            <h2 className="mt-3 text-3xl font-black text-gray-950">
              Conectare
            </h2>
            <p className="mt-3 text-gray-500 leading-7">
              Folosește emailul și parola contului tău pentru a intra în aplicație.
            </p>
          </div>

          <form className="grid gap-4" onSubmit={handleFormSubmit}>
            <label className="grid gap-2 text-sm font-bold text-gray-700">
              Email
              <input
                type="email"
                placeholder="exemplu@email.com"
                value={email}
                disabled={loggingIn}
                autoComplete="email"
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-gray-700">
              Parolă
              <input
                type="password"
                placeholder="Parola contului"
                value={password}
                disabled={loggingIn}
                autoComplete="current-password"
                onChange={(ev) => setPassword(ev.target.value)}
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full border-0 bg-primary px-8 py-3.5 font-black text-white shadow-sm shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingIn ? "Se verifică..." : "Conectare"}
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
                  disabled={loggingIn}
                  onClick={handleGoogleLogin}
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
              Nu ai cont?{" "}
              <Link className="font-black text-primary underline" href="/register">
                Creează unul aici
              </Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function LoginFallback() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-[2.5rem] border border-orange-100 bg-white p-6 shadow-sm md:p-10">
      <div className="grid min-h-[520px] place-items-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-primary" />
          <p className="mt-5 text-sm font-bold text-gray-500">Se pregătește pagina de conectare...</p>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
