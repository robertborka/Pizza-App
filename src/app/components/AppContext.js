"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { safeNumber } from "@/libs/formatters";

const AppContext = createContext(null);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProduct(product) {
  if (!product) {
    return null;
  }

  const productId = product._id || product.id || product.productId;

  if (!productId) {
    return null;
  }

  return {
    ...product,
    _id: String(productId),
    productId: String(productId),
    basePrice: safeNumber(product.basePrice ?? product.price, 0),
    price: safeNumber(product.price ?? product.basePrice, 0),
    image: product.image || "/pizza.png",
    name: product.name || "Produs",
    description: product.description || "",
    category: product.category || null,
    ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
  };
}

function getCartStorageKey(email) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return "cartProducts:guest";
  }

  return `cartProducts:${cleanEmail}`;
}

function readCartFromStorage(storageKey) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedCart = localStorage.getItem(storageKey);

    if (!storedCart) {
      return [];
    }

    const parsedCart = JSON.parse(storedCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart.map(normalizeProduct).filter(Boolean);
  } catch (error) {
    console.error("CART LOAD ERROR:", error);
    return [];
  }
}

function saveCartToStorage(storageKey, products) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(products));
  } catch (error) {
    console.error("CART SAVE ERROR:", error);
  }
}

function removeStorageItem(storageKey) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("CART REMOVE ERROR:", error);
  }
}

function removeLegacySharedCart() {
  removeStorageItem("cartProducts");
}

export function CartProvider({ children }) {
  const { data: session, status } = useSession();

  const [cartProducts, setCartProducts] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartStorageKey, setCartStorageKey] = useState("cartProducts:guest");

  const previousIdentityRef = useRef("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    removeLegacySharedCart();

    const currentEmail =
      status === "authenticated" ? normalizeEmail(session?.user?.email) : "";

    const currentIdentity = currentEmail || "guest";
    const newStorageKey = getCartStorageKey(currentEmail);

    setCartStorageKey(newStorageKey);

    const loadedCart = readCartFromStorage(newStorageKey);

    setCartProducts(loadedCart);
    previousIdentityRef.current = currentIdentity;
    setCartLoaded(true);
  }, [status, session?.user?.email]);

  useEffect(() => {
    if (!cartLoaded || status === "loading") {
      return;
    }

    saveCartToStorage(cartStorageKey, cartProducts);
  }, [cartProducts, cartLoaded, cartStorageKey, status]);

  function addToCart(product) {
    const normalizedProduct = normalizeProduct(product);

    if (!normalizedProduct) {
      console.error("Produs invalid pentru coș:", product);
      return;
    }

    setCartProducts((prev) => [...prev, normalizedProduct]);
  }

  function removeOneFromCart(productId) {
    setCartProducts((prev) => {
      const id = String(productId);
      const position = prev.findIndex((product) => product._id === id);

      if (position === -1) {
        return prev;
      }

      return prev.filter((_, index) => index !== position);
    });
  }

  function removeAllFromCart(productId) {
    setCartProducts((prev) => {
      const id = String(productId);
      return prev.filter((product) => product._id !== id);
    });
  }

  function clearCart() {
    setCartProducts([]);

    if (cartStorageKey) {
      saveCartToStorage(cartStorageKey, []);
    }
  }

  function clearCartForLogout() {
    const currentEmail = normalizeEmail(session?.user?.email);
    const currentUserStorageKey = getCartStorageKey(currentEmail);

    setCartProducts([]);

    saveCartToStorage(currentUserStorageKey, []);
    saveCartToStorage("cartProducts:guest", []);

    removeLegacySharedCart();
  }

  const cartTotal = useMemo(() => {
    return cartProducts.reduce((sum, product) => {
      return sum + safeNumber(product.basePrice ?? product.price, 0);
    }, 0);
  }, [cartProducts]);

  const cartCount = cartProducts.length;

  const value = {
    cartProducts,
    setCartProducts,
    cartTotal,
    cartCount,
    cartLoaded,

    addToCart,
    removeOneFromCart,
    removeAllFromCart,
    clearCart,
    clearCartForLogout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProvider({ children }) {
  return <CartProvider>{children}</CartProvider>;
}

export function useCart() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useCart trebuie folosit în interiorul CartProvider.");
  }

  return context;
}