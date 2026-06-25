"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionHeaders from "../components/layout/sectionHeaders";
import MenuItem from "../components/menu/menuItem";
import { useCart } from "../components/AppContext";

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

function getIngredientNames(ingredients) {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return ingredients
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

function getProductSearchText(product) {
  return normalizeText(
    [
      product.name,
      product.description,
      getCategoryName(product.category),
      getIngredientNames(product.ingredients).join(" "),
    ].join(" ")
  );
}

function buildCategories(products) {
  const categoriesMap = new Map();

  for (const product of products) {
    const categoryName = getCategoryName(product.category);

    if (!categoryName) {
      continue;
    }

    const key = normalizeText(categoryName);

    if (!categoriesMap.has(key)) {
      categoriesMap.set(key, categoryName);
    }
  }

  const categories = Array.from(categoriesMap.values());

  const preferredOrder = [
    "Pizza clasică",
    "Pizza premium",
    "Pizza picantă",
    "Pizza vegetariană",
    "Sosuri",
    "Băuturi",
    "Deserturi",
  ];

  categories.sort((a, b) => {
    const indexA = preferredOrder.findIndex(
      (item) => normalizeText(item) === normalizeText(a)
    );

    const indexB = preferredOrder.findIndex(
      (item) => normalizeText(item) === normalizeText(b)
    );

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, "ro");
    }

    if (indexA === -1) {
      return 1;
    }

    if (indexB === -1) {
      return -1;
    }

    return indexA - indexB;
  });

  return categories;
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

export default function MenuPage() {
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Toate");
  const [addedProduct, setAddedProduct] = useState(null);

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
          setError(data.error || "Nu am putut încărca meniul.");
          setProducts([]);
          return;
        }

        setProducts(normalizeMenuResponse(data));
      } catch (err) {
        console.error(err);

        if (!ignore) {
          setError("Meniul nu este disponibil momentan.");
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

  const categories = useMemo(() => {
    return ["Toate", ...buildCategories(products)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const normalizedActiveCategory = normalizeText(activeCategory);

    return products.filter((product) => {
      const categoryName = getCategoryName(product.category);
      const normalizedCategory = normalizeText(categoryName);

      const matchesCategory =
        activeCategory === "Toate" ||
        normalizedCategory === normalizedActiveCategory;

      const matchesSearch =
        !normalizedSearch ||
        getProductSearchText(product).includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, activeCategory]);

  function handleAddToCart(product) {
    addToCart(product);
    setAddedProduct(product);

    setTimeout(() => {
      setAddedProduct(null);
    }, 1600);
  }

  function clearFilters() {
    setSearch("");
    setActiveCategory("Toate");
  }

  const hasActiveFilters = search.trim() || activeCategory !== "Toate";

  return (
    <section className="relative mt-8 pb-16">
      <div className="absolute -left-24 top-32 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-24 top-96 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center mb-10">
        <SectionHeaders subHeader="Alege ce îți place" mainHeader="Meniu" />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Explorează produsele disponibile și adaugă rapid în coș pizza, sosuri,
          băuturi sau deserturi.
        </p>
      </div>

      <div className="relative bg-white rounded-[2rem] p-5 md:p-7 border border-gray-100 shadow-sm mb-10 overflow-hidden">
        <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 w-44 h-44 rounded-full bg-orange-200/30 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-end gap-5">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 mb-3">
                <label className="font-bold text-gray-900">
                  Caută în meniu
                </label>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="!w-auto border-0 bg-transparent p-0 text-sm font-bold text-primary hover:underline"
                  >
                    Resetează filtrele
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                  placeholder="Caută pizza, ingredient, sos, băutură sau desert..."
                  className="!my-0 !pl-11 !pr-4 !py-4 !rounded-2xl !bg-gray-50 !border-gray-200 focus:!bg-white focus:!border-primary"
                />
              </div>
            </div>

            <Link
              href="/ai-pizza"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 text-white px-6 py-4 font-bold hover:bg-primary transition"
            >
              <span>🤖</span>
              Încearcă AI Pizza
            </Link>
          </div>

          <div className="mt-6">
            <p className="font-bold text-gray-900 mb-3">Categorii</p>

            <div className="flex flex-wrap gap-3">
              {categories.map((category) => {
                const active = activeCategory === category;
                const emoji = category === "Toate" ? "🍽️" : getCategoryEmoji(category);

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={
                      active
                        ? "!w-auto inline-flex items-center gap-2 rounded-full border-0 bg-primary text-white px-5 py-3 font-bold shadow-md shadow-primary/20 transition"
                        : "!w-auto inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white text-gray-700 px-5 py-3 font-bold hover:border-primary hover:text-primary hover:-translate-y-0.5 hover:shadow-sm transition"
                    }
                  >
                    <span>{emoji}</span>
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-gray-500 text-sm">Produse afișate</p>
              <p className="font-bold text-gray-900 text-xl">
                {filteredProducts.length}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-gray-500 text-sm">Categoria selectată</p>
              <p className="font-bold text-gray-900 truncate">
                {activeCategory}
              </p>
            </div>

            <div className="rounded-2xl bg-orange-50 border border-primary/10 px-4 py-3">
              <p className="text-gray-500 text-sm">Total produse</p>
              <p className="font-bold text-primary text-xl">
                {products.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {addedProduct && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-gray-950 text-white px-6 py-4 shadow-2xl border border-white/10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            ✓
          </span>

          <span className="font-bold">
            {addedProduct.name} a fost adăugat în coș.
          </span>

          <Link href="/cart" className="text-primary font-bold hover:underline">
            Vezi coșul
          </Link>
        </div>
      )}

      {loadingProducts && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm animate-pulse"
            >
              <div className="h-56 bg-gray-100 rounded-3xl mb-5" />
              <div className="h-5 bg-gray-100 rounded mb-3" />
              <div className="h-4 bg-gray-100 rounded mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-5" />
              <div className="h-12 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loadingProducts && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center font-semibold">
          {error}
        </div>
      )}

      {!loadingProducts && !error && filteredProducts.length === 0 && (
        <div className="bg-white rounded-[2rem] p-10 border border-gray-100 text-center shadow-sm">
          <div className="text-5xl mb-4">🔍</div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Nu am găsit produse.
          </h2>

          <p className="text-gray-500 mb-6">
            Încearcă alt termen de căutare sau selectează altă categorie.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="!w-auto bg-primary text-white rounded-full px-8 py-3 font-bold border-0"
          >
            Resetează căutarea
          </button>
        </div>
      )}

      {!loadingProducts && !error && filteredProducts.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
          {filteredProducts.map((product) => (
            <MenuItem
              key={product._id}
              product={product}
              onAdd={() => handleAddToCart(product)}
            />
          ))}
        </div>
      )}
    </section>
  );
}