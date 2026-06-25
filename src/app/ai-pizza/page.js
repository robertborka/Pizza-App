"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../components/AppContext";
import { formatMoney } from "@/libs/formatters";

const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const AI_PIZZA_TIPS = [
  "Încarcă o poză clară cu pizza, preferabil făcută de sus.",
  "Sistemul identifică ingredientele vizibile și caută cea mai apropiată pizza din meniu.",
  "Poți adăuga produsul recomandat direct în coș.",
];

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

function getScoreColor(score) {
  if (score >= 85) {
    return "text-green-600 bg-green-50 border-green-100";
  }

  if (score >= 65) {
    return "text-orange-600 bg-orange-50 border-orange-100";
  }

  return "text-red-600 bg-red-50 border-red-100";
}

function shortText(value, maxLength = 140) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

async function readJsonResponse(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Răspuns invalid de la server. Status ${res.status}. Preview: ${text.slice(
        0,
        180
      )}`
    );
  }
}

function ProductCard({ product, label, onAddToCart }) {
  if (!product) {
    return null;
  }

  const price = getProductPrice(product);

  return (
    <div className="group rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-gray-50 flex items-center justify-center border border-gray-100">
          <img
            src={product.image || "/pizza.png"}
            alt={product.name || "Pizza recomandată"}
            className="h-full w-full object-contain group-hover:scale-105 transition"
          />
        </div>

        <div className="min-w-0 flex-1">
          {label && (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
              {label}
            </p>
          )}

          <h3 className="text-lg font-black text-gray-950 truncate">
            {product.name}
          </h3>

          <p className="mt-1 text-sm leading-6 text-gray-500">
            {shortText(product.description || "Produs din meniul Top Family Pizza.")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                {product.category}
              </span>
            )}

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {formatMoney(price)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAddToCart(product)}
          className="!w-full rounded-full border-0 bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition"
        >
          Adaugă în coș
        </button>

        <Link
          href={`/menu/${product._id}`}
          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary transition"
        >
          Vezi detalii
        </Link>
      </div>
    </div>
  );
}

function IngredientChip({ children }) {
  return (
    <span className="rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-bold text-primary">
      {children}
    </span>
  );
}

function ScoreRing({ value }) {
  const score = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gray-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#ff3d00 ${score * 3.6}deg, #f3f4f6 0deg)`,
        }}
      />

      <div className="relative flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-sm">
        <span className="text-2xl font-black text-gray-950">{score}%</span>
        <span className="text-[10px] font-bold uppercase text-gray-400">
          potrivire
        </span>
      </div>
    </div>
  );
}

function EmptyResultState() {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center rounded-[2rem] border border-gray-100 bg-gradient-to-br from-white to-orange-50/30 p-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-5xl shadow-inner">
        🤖
      </div>

      <h2 className="text-2xl font-black text-gray-950">Aștept imaginea</h2>

      <p className="mt-3 max-w-sm text-sm leading-7 text-gray-500">
        După analiză, aici apar ingredientele detectate, produsul recomandat,
        procentul de potrivire și alternativele din meniu.
      </p>

      <div className="mt-6 grid gap-3 text-left">
        {AI_PIZZA_TIPS.map((tip) => (
          <div
            key={tip}
            className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-gray-600 shadow-sm"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiPizzaPage() {
  const { addToCart } = useCart();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInputRef = useRef(null);

  const analysis = result?.analysis || null;
  const recommendedProduct = result?.recommendedProduct || null;
  const alternatives = Array.isArray(result?.alternatives)
    ? result.alternatives
    : [];

  const detectedIngredients = useMemo(() => {
    return Array.isArray(analysis?.detectedIngredients)
      ? analysis.detectedIngredients
      : [];
  }, [analysis]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function showNotice(text) {
    setNotice(text);

    setTimeout(() => {
      setNotice("");
    }, 1800);
  }

  function validateFile(file) {
    if (!file) {
      return "Nu ai selectat nicio imagine.";
    }

    if (!file.type?.startsWith("image/")) {
      return "Fișierul trebuie să fie o imagine JPG sau PNG.";
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Imaginea este prea mare. Limita este ${MAX_FILE_SIZE_MB} MB.`;
    }

    return "";
  }

  function handleFile(file) {
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError("");
  }

  function handleInputChange(ev) {
    const file = ev.target.files?.[0];

    if (file) {
      handleFile(file);
    }
  }

  function handleDrop(ev) {
    ev.preventDefault();
    setDragActive(false);

    const file = ev.dataTransfer.files?.[0];

    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(ev) {
    ev.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(ev) {
    ev.preventDefault();
    setDragActive(false);
  }

  async function analyzePizza() {
    if (!selectedFile || analyzing) {
      return;
    }

    setAnalyzing(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await fetch("/api/ai/pizza-recognition", {
        method: "POST",
        body: formData,
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.error || "Imaginea nu a putut fi analizată.");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "A apărut o eroare la analiză.");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
  }

  function handleAddToCart(product) {
    addToCart(product);
    showNotice(`${product.name} a fost adăugat în coș.`);
  }

  return (
    <section className="relative mt-6 overflow-hidden rounded-[2.5rem] bg-white shadow-sm">
      {notice && (
        <div className="fixed bottom-24 right-8 z-50 rounded-full bg-gray-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {notice}
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-[2.5rem] bg-gray-950 text-white"
        style={{
          backgroundImage:
            "linear-gradient(270deg, rgba(3,7,18,.94), rgba(3,7,18,.74), rgba(3,7,18,.10)), url('/ai/ai-pizza-robot-hero.webp')",
          backgroundSize: "cover",
          backgroundPosition: "left center",
        }}
      >
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-20 right-20 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative grid min-h-[560px] gap-8 px-6 py-12 md:grid-cols-[0.9fr_1.1fr] md:px-10 lg:px-14 lg:py-16">
          <div className="hidden md:block" />

          <div className="max-w-2xl self-center md:ml-auto">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-bold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Recunoaștere vizuală pentru recomandări pizza
            </div>

            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Încarcă poza.
              <span className="block text-primary">Primești recomandarea.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-8 text-white/75">
              Aplicația analizează ingredientele vizibile din fotografie și îți
              recomandă cea mai apropiată pizza din meniul Top Family Pizza.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-black">1</p>
                <p className="mt-1 text-sm text-white/65">Încarci poza</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-black">2</p>
                <p className="mt-1 text-sm text-white/65">Sistemul detectează ingredientele</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-black">3</p>
                <p className="mt-1 text-sm text-white/65">Primești recomandarea</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-b from-orange-50/40 to-white px-4 py-8 md:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <div className="rounded-[2.25rem] border border-gray-100 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-primary">
                  Pasul 1
                </p>

                <h2 className="mt-1 text-3xl font-black text-gray-950">
                  Încarcă imaginea
                </h2>
              </div>

              <span className="rounded-full bg-primary/10 px-4 py-2 text-xs font-black text-primary">
                JPG / PNG
              </span>
            </div>

            <p className="mb-5 text-sm leading-7 text-gray-500">
              Folosește o poză clară, cu pizza vizibilă și lumină bună. Pentru rezultate mai bune, fotografia trebuie să surprindă ingredientele și forma pizzei.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={
                dragActive
                  ? "!w-full rounded-[2rem] border-2 border-primary bg-primary/5 p-4 text-center transition"
                  : "!w-full rounded-[2rem] border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center hover:border-primary hover:bg-primary/5 transition"
              }
            >
              <div className="flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-[1.5rem] bg-white">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview pizza"
                    className="h-[300px] w-full rounded-[1.5rem] object-cover"
                  />
                ) : (
                  <>
                    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">
                      🍕
                    </div>

                    <p className="text-xl font-black text-gray-950">
                      Trage poza aici sau apasă pentru upload
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      Imagine maxim {MAX_FILE_SIZE_MB} MB. Recomandat: lumină bună.
                    </p>
                  </>
                )}
              </div>
            </button>

            {selectedFile && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {selectedFile.name}
                    </p>

                    <p className="text-xs text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetImage}
                    className="!w-auto rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 hover:text-primary"
                  >
                    Schimbă
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={analyzePizza}
                disabled={!selectedFile || analyzing}
                className="!w-auto rounded-full border-0 bg-primary px-8 py-4 font-black text-white shadow-lg shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? "Se analizează..." : "Analizează pizza"}
              </button>

              <Link
                href="/menu"
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-8 py-4 font-black text-gray-700 hover:border-primary hover:text-primary transition"
              >
                Vezi meniul
              </Link>
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-gray-100 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-primary">
                  Pasul 2
                </p>

                <h2 className="mt-1 text-3xl font-black text-gray-950">
                  Rezultat analiză
                </h2>
              </div>

              <span className="rounded-full bg-gray-100 px-4 py-2 text-xs font-black text-gray-600">
                Recomandare live
              </span>
            </div>

            {!result && !analyzing && <EmptyResultState />}

            {analyzing && (
              <div className="flex min-h-[390px] flex-col items-center justify-center rounded-[2rem] border border-orange-100 bg-orange-50/50 p-8 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-sm">
                  🤖
                </div>

                <h2 className="text-2xl font-black text-gray-950">
                  Se analizează pizza...
                </h2>

                <p className="mt-3 max-w-sm text-sm leading-7 text-gray-500">
                  Caut ingrediente vizibile, stilul pizzei și produsul cel mai
                  apropiat din meniul restaurantului.
                </p>

                <div className="mt-6 h-3 w-full max-w-sm overflow-hidden rounded-full bg-white">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                </div>
              </div>
            )}

            {result && analysis && (
              <div className="space-y-5">
                <div className="rounded-[2rem] border border-gray-100 bg-gradient-to-br from-white to-orange-50/50 p-5">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center">
                    <ScoreRing value={analysis.matchPercent} />

                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-4 py-2 text-xs font-black ${getScoreColor(
                            analysis.matchPercent
                          )}`}
                        >
                          {analysis.pizzaDetected
                            ? "Pizza detectată"
                            : "Pizza detectată incert"}
                        </span>

                        <span className="rounded-full border border-gray-100 bg-white px-4 py-2 text-xs font-black text-gray-600">
                          {analysis.pizzaStyle || "Stil pizza"}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black text-gray-950">
                        {recommendedProduct?.name || "Recomandare indisponibilă"}
                      </h3>

                      <p className="mt-2 text-sm leading-7 text-gray-500">
                        {analysis.reason}
                      </p>
                    </div>
                  </div>
                </div>

                {recommendedProduct && (
                  <ProductCard
                    product={recommendedProduct}
                    label="Cea mai apropiată pizza"
                    onAddToCart={handleAddToCart}
                  />
                )}

                <div className="rounded-[2rem] border border-gray-100 bg-white p-5">
                  <h3 className="text-lg font-black text-gray-950">
                    Ingrediente detectate
                  </h3>

                  {detectedIngredients.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detectedIngredients.map((ingredient) => (
                        <IngredientChip key={ingredient}>
                          {ingredient}
                        </IngredientChip>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">
                      Sistemul nu a detectat clar ingredientele. Poza poate fi prea
                      întunecată, prea apropiată sau ingredientele nu sunt vizibile.
                    </p>
                  )}
                </div>

                <div className="rounded-[2rem] border border-gray-100 bg-white p-5">
                  <h3 className="text-lg font-black text-gray-950">
                    Ce s-a observat în imagine
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-gray-500">
                    {analysis.imageDescription}
                  </p>

                  {Array.isArray(analysis.visualNotes) &&
                    analysis.visualNotes.length > 0 && (
                      <div className="mt-4 grid gap-2">
                        {analysis.visualNotes.map((note) => (
                          <div
                            key={note}
                            className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {alternatives.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-xl font-black text-gray-950">
                      Alternative apropiate
                    </h3>

                    <div className="grid gap-4">
                      {alternatives.map((product) => (
                        <ProductCard
                          key={product._id}
                          product={product}
                          label="Alternativă"
                          onAddToCart={handleAddToCart}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(analysis.tips) && analysis.tips.length > 0 && (
                  <div className="rounded-[2rem] border border-orange-100 bg-orange-50 p-5">
                    <h3 className="text-lg font-black text-gray-950">
                      Sfaturi pentru analiză mai bună
                    </h3>

                    <div className="mt-4 grid gap-2">
                      {analysis.tips.map((tip) => (
                        <p key={tip} className="text-sm leading-7 text-gray-600">
                          • {tip}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              👁️
            </div>

            <h3 className="text-lg font-black text-gray-950">Analiză vizuală</h3>

            <p className="mt-2 text-sm leading-7 text-gray-500">
              Sistemul caută ingredientele vizibile și descrie pizza încărcată.
            </p>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              🍕
            </div>

            <h3 className="text-lg font-black text-gray-950">Potrivire cu meniul</h3>

            <p className="mt-2 text-sm leading-7 text-gray-500">
              Recomandarea este aleasă dintre produsele disponibile în meniul actual.
            </p>
          </div>

          <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              🛒
            </div>

            <h3 className="text-lg font-black text-gray-950">Adăugare rapidă</h3>

            <p className="mt-2 text-sm leading-7 text-gray-500">
              Pizza recomandată poate fi adăugată direct în coș.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}