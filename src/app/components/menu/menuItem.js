"use client";

import Link from "next/link";
import { useCart } from "../AppContext";
import { formatMoney } from "@/libs/formatters";

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

function getProductPrice(product) {
  return Number(product?.basePrice ?? product?.price ?? 0);
}

export default function MenuItem({ product, onAdd }) {
  const { addToCart } = useCart();

  const safeProduct =
    product || {
      _id: "",
      name: "Pizza Margherita",
      description: "Pizza cu sos de roșii, mozzarella și busuioc proaspăt.",
      image: "/pizza.png",
      basePrice: 12,
      category: "Pizza",
      ingredients: [],
    };

  const productId = String(safeProduct._id || safeProduct.id || "");
  const categoryName = getCategoryName(safeProduct.category);
  const ingredientNames = getIngredientNames(safeProduct.ingredients);
  const price = getProductPrice(safeProduct);

  function handleAddToCart() {
    if (typeof onAdd === "function") {
      onAdd(safeProduct);
      return;
    }

    addToCart(safeProduct);
  }

  return (
    <article className="group bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden">
      <Link
        href={productId ? `/menu/${productId}` : "/menu"}
        className="block"
        aria-label={`Vezi detalii pentru ${safeProduct.name}`}
      >
        <div className="relative bg-gradient-to-br from-orange-50 via-white to-gray-50 rounded-3xl h-56 flex items-center justify-center overflow-hidden border border-gray-100">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl z-0" />
          <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-orange-200/40 rounded-full blur-2xl z-0" />

          {categoryName && (
            <span className="absolute left-3 top-3 z-30 bg-white/95 backdrop-blur rounded-full px-3 py-1 text-xs font-bold text-gray-700 border border-gray-200 shadow-sm max-w-[160px] truncate">
              {categoryName}
            </span>
          )}

          <span className="absolute right-3 top-3 z-30 bg-primary text-white rounded-full px-3 py-1 text-sm font-bold shadow-sm">
            {formatMoney(price)}
          </span>

          <img
            src={safeProduct.image || "/pizza.png"}
            alt={safeProduct.name || "Produs"}
            className="relative z-10 max-h-48 max-w-[82%] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-xl"
          />
        </div>
      </Link>

      <div className="pt-5 flex flex-col flex-1">
        <h4 className="font-bold text-xl text-gray-900 leading-tight min-h-[56px]">
          {safeProduct.name}
        </h4>

        <p className="text-gray-500 text-sm leading-6 mt-2 min-h-[72px]">
          {safeProduct.description ||
            "Produs pregătit cu ingrediente atent selectate."}
        </p>

        {ingredientNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 min-h-[34px]">
            {ingredientNames.slice(0, 3).map((ingredient) => (
              <span
                key={ingredient}
                className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs font-semibold"
              >
                {ingredient}
              </span>
            ))}

            {ingredientNames.length > 3 && (
              <span className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs font-semibold">
                +{ingredientNames.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3 mt-auto pt-5">
          <button
            type="button"
            onClick={handleAddToCart}
            className="!w-full bg-primary text-white border-0 rounded-full px-5 py-3 font-bold shadow-sm hover:shadow-md hover:shadow-primary/30 transition"
          >
            Adaugă
          </button>

          <Link
            href={productId ? `/menu/${productId}` : "/menu"}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 px-5 py-3 font-bold hover:border-primary hover:text-primary transition"
          >
            Detalii
          </Link>
        </div>
      </div>
    </article>
  );
}