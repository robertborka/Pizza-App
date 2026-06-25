"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/libs/formatters";
import { useParams, useRouter } from "next/navigation";
import SectionHeaders from "../../components/layout/sectionHeaders";
import MenuItem from "../../components/menu/menuItem";
import { useCart } from "../../components/AppContext";

function normalizeMenuResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.menuItems)) {
    return data.menuItems;
  }

  if (Array.isArray(data.products)) {
    return data.products;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

function isProbablyObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCategoryName(category) {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    return isProbablyObjectId(category) ? "" : category;
  }

  return category.name || "";
}

function getIngredientSource(product) {
  if (!product) {
    return [];
  }

  if (Array.isArray(product.ingredients)) {
    return product.ingredients;
  }

  if (Array.isArray(product.ingredientIds)) {
    return product.ingredientIds;
  }

  if (Array.isArray(product.selectedIngredients)) {
    return product.selectedIngredients;
  }

  if (Array.isArray(product.ingrediente)) {
    return product.ingrediente;
  }

  return [];
}

function getIngredientNames(product) {
  return getIngredientSource(product)
    .map((ingredient) => {
      if (!ingredient) {
        return "";
      }

      if (typeof ingredient === "string") {
        return isProbablyObjectId(ingredient) ? "" : ingredient;
      }

      return ingredient.name || "";
    })
    .filter(Boolean);
}

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

function getCategoryEmoji(category) {
  const normalizedCategory = normalizeText(category);

  if (normalizedCategory.includes("clasica")) {
    return "🍕";
  }

  if (normalizedCategory.includes("premium")) {
    return "⭐";
  }

  if (normalizedCategory.includes("picanta")) {
    return "🌶️";
  }

  if (normalizedCategory.includes("vegetariana")) {
    return "🥬";
  }

  if (normalizedCategory.includes("sos")) {
    return "🥣";
  }

  if (normalizedCategory.includes("baut")) {
    return "🥤";
  }

  if (normalizedCategory.includes("desert")) {
    return "🍰";
  }

  return "🍽️";
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const productId = String(params?.id || "");

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        setError("");

        const res = await fetch("/api/menu", {
          cache: "no-store",
        });

        const data = await res.json();

        if (ignore) {
          return;
        }

        if (!res.ok) {
          setError(data.error || "Nu am putut încărca produsul.");
          setProducts([]);
          return;
        }

        setProducts(normalizeMenuResponse(data));
      } catch (err) {
        console.error(err);

        if (!ignore) {
          setError("A apărut o eroare la încărcarea produsului.");
          setProducts([]);
        }
      } finally {
        if (!ignore) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  const product = useMemo(() => {
    return products.find((item) => String(item._id || item.id) === productId);
  }, [products, productId]);

  const categoryName = getCategoryName(product?.category);
  const ingredientNames = getIngredientNames(product);
  const price = getProductPrice(product);
  const categoryEmoji = getCategoryEmoji(categoryName);

  const similarProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    const normalizedCurrentCategory = normalizeText(
      getCategoryName(product.category)
    );

    const sameCategory = products.filter((item) => {
      const itemId = String(item._id || item.id);
      const itemCategory = normalizeText(getCategoryName(item.category));

      return itemId !== productId && itemCategory === normalizedCurrentCategory;
    });

    if (sameCategory.length > 0) {
      return sameCategory.slice(0, 3);
    }

    return products
      .filter((item) => String(item._id || item.id) !== productId)
      .slice(0, 3);
  }, [products, product, productId]);

  function handleAddToCart() {
    if (!product) {
      return;
    }

    addToCart(product);
    setAddedMessage(`${product.name} a fost adăugat în coș.`);

    setTimeout(() => {
      setAddedMessage("");
    }, 1800);
  }

  if (loadingProducts) {
    return (
      <section className="mt-8">
        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 animate-pulse">
            <div className="h-[420px] rounded-[2rem] bg-gray-100" />

            <div className="flex flex-col justify-center">
              <div className="h-6 bg-gray-100 rounded w-36 mb-5" />
              <div className="h-12 bg-gray-100 rounded w-3/4 mb-4" />
              <div className="h-5 bg-gray-100 rounded w-full mb-3" />
              <div className="h-5 bg-gray-100 rounded w-2/3 mb-8" />
              <div className="h-14 bg-gray-100 rounded-full w-52" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-[2rem] p-8 text-center font-semibold">
          {error}
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="mt-8">
        <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm text-center">
          <div className="text-6xl mb-5">🔍</div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Produsul nu a fost găsit.
          </h1>

          <p className="text-gray-500 mb-7">
            Produsul selectat nu există sau nu mai este disponibil în meniu.
          </p>

          <Link
            href="/menu"
            className="inline-block bg-primary text-white rounded-full px-8 py-3 font-bold"
          >
            Înapoi la meniu
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-8 pb-16">
      <div className="absolute -left-24 top-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-24 top-96 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

      {addedMessage && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-gray-950 text-white px-6 py-4 shadow-2xl border border-white/10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            ✓
          </span>

          <span className="font-bold">{addedMessage}</span>

          <Link href="/cart" className="text-primary font-bold hover:underline">
            Vezi coșul
          </Link>
        </div>
      )}

      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="!w-auto border border-gray-300 bg-white text-gray-700 rounded-full px-5 py-3 font-bold hover:border-primary hover:text-primary transition"
        >
          ← Înapoi
        </button>
      </div>

      <div className="relative bg-white rounded-[2.5rem] p-5 md:p-8 border border-gray-100 shadow-sm overflow-hidden">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />

        <div className="relative grid lg:grid-cols-[0.95fr_1.05fr] gap-8 lg:gap-12 items-center">
          <div className="relative rounded-[2rem] min-h-[420px] bg-gradient-to-br from-orange-50 via-white to-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
            <div className="absolute left-5 top-5 z-20 bg-white/95 backdrop-blur rounded-full px-4 py-2 text-sm font-bold text-gray-700 border border-gray-200 shadow-sm">
              {categoryEmoji} {categoryName || "Produs"}
            </div>

            <div className="absolute right-5 top-5 z-20 bg-primary text-white rounded-full px-5 py-2 text-lg font-bold shadow-sm">
              {formatMoney(price)}
            </div>

            <Image
              src={product.image || "/pizza.png"}
              alt={product.name || "Produs"}
              width={680}
              height={680}
              priority
              className="relative z-10 w-full max-w-[520px] max-h-[520px] object-contain drop-shadow-2xl p-8"
            />
          </div>

          <div>
            <p className="text-primary uppercase text-sm font-bold mb-3">
              Detalii produs
            </p>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

            <p className="text-gray-600 text-lg leading-8 mt-5">
              {product.description ||
                "Produs pregătit cu ingrediente atent selectate."}
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
                <p className="text-gray-500 text-sm">Categorie</p>
                <p className="font-bold text-gray-900 mt-1">
                  {categoryName || "Nespecificată"}
                </p>
              </div>

              <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
                <p className="text-gray-500 text-sm">Preț</p>
                <p className="font-bold text-primary text-2xl mt-1">
                  {formatMoney(price)}
                </p>
              </div>

              <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
                <p className="text-gray-500 text-sm">Disponibilitate</p>
                <p className="font-bold text-green-700 mt-1">În meniu</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Ingrediente
              </h2>

              {ingredientNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ingredientNames.map((ingredient) => (
                    <span
                      key={ingredient}
                      className="bg-orange-50 border border-primary/10 text-gray-700 rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-yellow-800">
                  <p className="font-bold mb-1">
                    Ingredientele nu sunt asociate acestui produs.
                  </p>

                  <p className="text-sm leading-6">
                    Verifică în panoul de administrare dacă produsul are
                    ingrediente selectate și salvează din nou produsul.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handleAddToCart}
                className="!w-auto bg-primary text-white rounded-full px-9 py-4 font-bold border-0 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition"
              >
                Adaugă în coș
              </button>

              <Link
                href="/cart"
                className="inline-flex items-center justify-center border border-gray-300 text-gray-700 bg-white rounded-full px-9 py-4 font-bold hover:border-primary hover:text-primary transition"
              >
                Vezi coșul
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-20">
        <div className="text-center mb-10">
          <SectionHeaders
            subHeader="Poate îți place și"
            mainHeader="Produse similare"
          />

          <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
            Alte produse din aceeași categorie sau produse apropiate din meniu.
          </p>
        </div>

        {similarProducts.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-8 text-center border border-gray-100 shadow-sm text-gray-500">
            Nu există produse similare disponibile momentan.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            {similarProducts.map((similarProduct) => (
              <MenuItem
                key={similarProduct._id}
                product={similarProduct}
                onAdd={() => {
                  addToCart(similarProduct);
                  setAddedMessage(
                    `${similarProduct.name} a fost adăugat în coș.`
                  );

                  setTimeout(() => {
                    setAddedMessage("");
                  }, 1800);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}