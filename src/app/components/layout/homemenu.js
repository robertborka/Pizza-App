"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionHeaders from "./sectionHeaders";
import MenuItem from "../menu/menuItem";
import { useCart } from "../AppContext";

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

function getCategoryName(category) {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    return isProbablyObjectId(category) ? "" : category;
  }

  return category.name || "";
}

export default function HomeMenu() {
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");
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
          setError(data.error || "Meniul nu este disponibil momentan.");
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

  const featuredProducts = useMemo(() => {
    const pizzaProducts = products.filter((product) => {
      const categoryName = getCategoryName(product.category).toLowerCase();
      const productName = String(product.name || "").toLowerCase();

      return categoryName.includes("pizza") || productName.includes("pizza");
    });

    const source = pizzaProducts.length > 0 ? pizzaProducts : products;

    return source.slice(0, 6);
  }, [products]);

  return (
    <section className="relative mt-20">
      <div className="absolute -left-16 top-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -right-16 bottom-20 w-40 h-40 bg-orange-300/20 rounded-full blur-3xl" />

      <div className="relative text-center mb-10">
        <SectionHeaders subHeader="Recomandări populare" mainHeader="Meniu" />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Câteva produse potrivite pentru o comandă rapidă. Pentru lista
          completă, intră în meniul restaurantului.
        </p>
      </div>

      {loadingProducts && (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm animate-pulse"
            >
              <div className="h-48 bg-gray-100 rounded-2xl mb-5" />
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

      {!loadingProducts && !error && featuredProducts.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center text-gray-500">
          Nu există produse disponibile momentan.
        </div>
      )}

      {!loadingProducts && !error && featuredProducts.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <MenuItem
                key={product._id}
                product={product}
                onAdd={() => addToCart(product)}
              />
            ))}
          </div>

          <div className="flex justify-center mt-10">
            <Link
              href="/menu"
              className="bg-primary text-white rounded-full px-8 py-3 font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition"
            >
              Vezi meniul complet
            </Link>
          </div>
        </>
      )}
    </section>
  );
}