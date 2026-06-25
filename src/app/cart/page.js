"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useCart } from "../components/AppContext";
import SectionHeaders from "../components/layout/sectionHeaders";
import DeliveryRouteMap from "../components/maps/DeliveryRouteMap";
import { formatDateTime, formatDistanceKm, formatMinutes, formatMoney } from "@/libs/formatters";
import { getOrderProductLineTotal, getOrderProductUnitPrice } from "@/libs/orderUtils";

function getRiskLabel(riskLevel) {
  if (riskLevel === "low") {
    return "Risc redus";
  }

  if (riskLevel === "medium") {
    return "Risc mediu";
  }

  if (riskLevel === "high") {
    return "Risc ridicat";
  }

  return "Risc mediu";
}

function getRiskClass(riskLevel) {
  if (riskLevel === "low") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (riskLevel === "medium") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  if (riskLevel === "high") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

function getProductCategoryName(category) {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    return category;
  }

  return category.name || "";
}

function shortOrderId(orderId) {
  if (!orderId) {
    return "";
  }

  return `#${String(orderId).slice(-6).toUpperCase()}`;
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function buildFullAddress(addressData) {
  const streetLine = [addressData.street, addressData.streetNumber]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");

  const extraParts = [];

  if (addressData.building?.trim()) {
    extraParts.push(`Bloc ${addressData.building.trim()}`);
  }

  if (addressData.entrance?.trim()) {
    extraParts.push(`Scara ${addressData.entrance.trim()}`);
  }

  if (addressData.floor?.trim()) {
    extraParts.push(`Etaj ${addressData.floor.trim()}`);
  }

  if (addressData.apartment?.trim()) {
    extraParts.push(`Ap. ${addressData.apartment.trim()}`);
  }

  return [streetLine, ...extraParts].filter(Boolean).join(", ");
}

function RecommendationCard({ recommendation, onAdd }) {
  const product = recommendation?.product;

  if (!product) {
    return null;
  }

  return (
    <article className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full min-h-[520px]">
      <div className="w-full h-[190px] rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center mb-4">
        <img
          src={product.image || "/pizza.png"}
          alt={product.name || "Produs recomandat"}
          className="w-full h-full object-contain p-3 transition-transform duration-300 hover:scale-105"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 min-h-[30px]">
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold">
          {recommendation.badge || "Recomandare"}
        </span>

        <span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold">
          {recommendation.matchScore || 80}% potrivire
        </span>
      </div>

      <h4 className="font-bold text-gray-900 text-xl leading-tight mb-2 min-h-[56px] flex items-start">
        {product.name}
      </h4>

      <p className="text-gray-500 text-sm leading-6 mb-4 min-h-[72px] overflow-hidden">
        {product.description || "Produs recomandat pentru completarea comenzii."}
      </p>

      <div className="bg-orange-50 border border-primary/10 rounded-2xl p-3 mb-5 min-h-[130px]">
        <p className="text-xs uppercase tracking-wide text-primary font-bold mb-2">
          Recomandare personalizată
        </p>

        <p className="text-gray-600 text-sm leading-6">
          {recommendation.reason ||
            "Acest produs completează bine selecția din coș și poate îmbunătăți experiența comenzii."}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <p className="font-bold text-primary text-2xl leading-none">
          {formatMoney(product.basePrice ?? product.price)}
        </p>

        <button
          type="button"
          onClick={() => onAdd(product)}
          className="!w-auto bg-primary text-white border-0 rounded-full px-6 py-3 font-bold shadow-sm hover:shadow-md hover:shadow-primary/30 transition"
        >
          Adaugă
        </button>
      </div>
    </article>
  );
}

export default function CartPage() {
  const { data: session, status } = useSession();

  const {
    cartProducts,
    cartTotal,
    addToCart,
    removeOneFromCart,
    removeAllFromCart,
    clearCart,
  } = useCart();

  const [customerData, setCustomerData] = useState({
    name: "",
    phone: "",
    city: "Brașov",
    street: "",
    streetNumber: "",
    building: "",
    entrance: "",
    floor: "",
    apartment: "",
    notes: "",
  });

  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileAutoFilled, setProfileAutoFilled] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

  const [cartRecommendations, setCartRecommendations] = useState([]);
  const [cartRecommendationSummary, setCartRecommendationSummary] =
    useState("");
  const [cartRecommendationSource, setCartRecommendationSource] = useState("");
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");

  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [streetLoading, setStreetLoading] = useState(false);
  const [streetError, setStreetError] = useState("");
  const [streetDropdownOpen, setStreetDropdownOpen] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState(null);

  const groupedProducts = useMemo(() => {
    const groups = {};

    for (const product of cartProducts) {
      if (!product?._id) {
        continue;
      }

      if (!groups[product._id]) {
        groups[product._id] = {
          product,
          quantity: 0,
        };
      }

      groups[product._id].quantity += 1;
    }

    return Object.values(groups);
  }, [cartProducts]);

  const fullAddressPreview = useMemo(() => {
    return buildFullAddress(customerData);
  }, [customerData]);

  const checkoutDisabled =
    placingOrder ||
    cartProducts.length === 0 ||
    !customerData.name.trim() ||
    !isValidPhone(customerData.phone) ||
    !customerData.city.trim() ||
    !customerData.street.trim() ||
    !customerData.streetNumber.trim();

  function applyProfileToCheckout(profile, force = false) {
    if (!profile) {
      return;
    }

    setCustomerData((prev) => ({
      ...prev,
      name: force ? profile.name || "" : prev.name || profile.name || "",
      phone: force ? profile.phone || "" : prev.phone || profile.phone || "",
      city: force
        ? profile.city || "Brașov"
        : prev.city || profile.city || "Brașov",
      street: force ? profile.street || "" : prev.street || profile.street || "",
      streetNumber: force
        ? profile.streetNumber || ""
        : prev.streetNumber || profile.streetNumber || "",
      building: force
        ? profile.building || ""
        : prev.building || profile.building || "",
      entrance: force
        ? profile.entrance || ""
        : prev.entrance || profile.entrance || "",
      floor: force ? profile.floor || "" : prev.floor || profile.floor || "",
      apartment: force
        ? profile.apartment || ""
        : prev.apartment || profile.apartment || "",
      notes: force
        ? profile.defaultNotes || ""
        : prev.notes || profile.defaultNotes || "",
    }));

    setProfileAutoFilled(true);
  }

  useEffect(() => {
    if (session?.user?.name) {
      setCustomerData((prev) => ({
        ...prev,
        name: prev.name || session.user.name,
      }));
    }
  }, [session]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let ignore = false;

    async function loadProfileForCheckout() {
      try {
        setProfileLoading(true);

        const res = await fetch("/api/profile", {
          cache: "no-store",
        });

        const data = await res.json();

        if (ignore) {
          return;
        }

        if (!res.ok) {
          return;
        }

        setProfileData(data);
        applyProfileToCheckout(data, false);
      } catch (error) {
        console.error(error);
      } finally {
        if (!ignore) {
          setProfileLoading(false);
        }
      }
    }

    loadProfileForCheckout();

    return () => {
      ignore = true;
    };
  }, [status]);

  useEffect(() => {
    let ignore = false;
    let timeoutId = null;

    async function loadCartRecommendations() {
      if (createdOrder || cartProducts.length === 0) {
        setCartRecommendations([]);
        setCartRecommendationSummary("");
        setCartRecommendationSource("");
        setRecommendationsError("");
        setRecommendationsLoading(false);
        return;
      }

      try {
        setRecommendationsLoading(true);
        setRecommendationsError("");

        const res = await fetch("/api/ai/cart-recommendations", {
          method: "POST",
          body: JSON.stringify({
            cartProducts,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await res.json();

        if (ignore) {
          return;
        }

        if (!res.ok) {
          setRecommendationsError(
            data.error || "Nu am putut genera recomandări."
          );
          setCartRecommendations([]);
          setCartRecommendationSummary("");
          setCartRecommendationSource("");
          return;
        }

        setCartRecommendations(
          Array.isArray(data.recommendations) ? data.recommendations : []
        );

        setCartRecommendationSummary(data.summary || "");
        setCartRecommendationSource(
          data.aiUsed ? "Motor inteligent" : "Reguli interne"
        );
      } catch (error) {
        console.error(error);

        if (!ignore) {
          setRecommendationsError(
            "A apărut o eroare la generarea recomandărilor."
          );
          setCartRecommendations([]);
          setCartRecommendationSummary("");
          setCartRecommendationSource("");
        }
      } finally {
        if (!ignore) {
          setRecommendationsLoading(false);
        }
      }
    }

    timeoutId = setTimeout(loadCartRecommendations, 500);

    return () => {
      ignore = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [cartProducts, createdOrder]);

  useEffect(() => {
    const query = customerData.street.trim();

    if (!streetDropdownOpen || query.length < 2) {
      setStreetSuggestions([]);
      setStreetLoading(false);
      setStreetError("");
      return;
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        setStreetLoading(true);
        setStreetError("");

        const params = new URLSearchParams({
          q: query,
          city: customerData.city || "Brașov",
        });

        const res = await fetch(`/api/street-autocomplete?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          setStreetError(data.error || "Nu am putut căuta strada.");
          setStreetSuggestions([]);
          return;
        }

        setStreetSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : []
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
          setStreetError("A apărut o eroare la căutarea străzii.");
          setStreetSuggestions([]);
        }
      } finally {
        setStreetLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [customerData.street, customerData.city, streetDropdownOpen]);

  function handleInputChange(ev) {
    const { name, value } = ev.target;

    if (name === "street") {
      setSelectedStreet(null);
      setStreetDropdownOpen(true);
    }

    if (name === "city") {
      setSelectedStreet(null);
      setStreetSuggestions([]);
    }

    setCustomerData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleStreetSelect(suggestion) {
    setSelectedStreet(suggestion);
    setStreetDropdownOpen(false);
    setStreetSuggestions([]);

    setCustomerData((prev) => ({
      ...prev,
      street: suggestion.fullStreet || suggestion.label || prev.street,
    }));
  }

  function buildProductsForDeliveryEstimate(productsGrouped) {
    return productsGrouped.map(({ product, quantity }) => ({
      id: product._id,
      name: product.name || "",
      category: getProductCategoryName(product.category),
      quantity,
      basePrice: getOrderProductUnitPrice(product),
    }));
  }

  async function loadDeliveryEstimate({
    cleanCustomerData,
    productsForEstimate,
    totalPrice,
    orderId,
  }) {
    try {
      setDeliveryLoading(true);
      setDeliveryError("");
      setDeliveryEstimate(null);

      const res = await fetch("/api/delivery-estimate", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          address: cleanCustomerData.address,
          city: cleanCustomerData.city,
          country: "România",

          street: cleanCustomerData.street,
          streetNumber: cleanCustomerData.streetNumber,
          building: cleanCustomerData.building,
          entrance: cleanCustomerData.entrance,
          floor: cleanCustomerData.floor,
          apartment: cleanCustomerData.apartment,

          notes: cleanCustomerData.notes,
          products: productsForEstimate,
          totalPrice,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setDeliveryError(
          data.error || "Nu am putut calcula estimarea de livrare."
        );
        return;
      }

      setDeliveryEstimate(data);
    } catch (error) {
      console.error(error);
      setDeliveryError("A apărut o eroare la calcularea livrării.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function handleCheckoutSubmit(ev) {
    ev.preventDefault();

    if (placingOrder) {
      return;
    }

    setMessage("");
    setMessageType("");
    setCreatedOrder(null);
    setDeliveryEstimate(null);
    setDeliveryError("");

    const fullAddress = buildFullAddress(customerData);

    const cleanCustomerData = {
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      city: customerData.city.trim(),
      address: fullAddress,
      street: customerData.street.trim(),
      streetNumber: customerData.streetNumber.trim(),
      building: customerData.building.trim(),
      entrance: customerData.entrance.trim(),
      floor: customerData.floor.trim(),
      apartment: customerData.apartment.trim(),
      notes: customerData.notes.trim(),
    };

    if (cartProducts.length === 0) {
      setMessageType("error");
      setMessage("Coșul este gol.");
      return;
    }

    if (!cleanCustomerData.name) {
      setMessageType("error");
      setMessage("Completează numele pentru comandă.");
      return;
    }

    if (!isValidPhone(cleanCustomerData.phone)) {
      setMessageType("error");
      setMessage("Completează un număr de telefon valid.");
      return;
    }

    if (!cleanCustomerData.city) {
      setMessageType("error");
      setMessage("Completează orașul.");
      return;
    }

    if (!cleanCustomerData.street || !cleanCustomerData.streetNumber) {
      setMessageType("error");
      setMessage("Completează strada și numărul pentru livrare.");
      return;
    }

    try {
      setPlacingOrder(true);

      const productsForEstimate =
        buildProductsForDeliveryEstimate(groupedProducts);

      const totalPriceForEstimate = cartTotal;

      const res = await fetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          cartProducts,
          customerData: cleanCustomerData,
          userEmail: session?.user?.email || "",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error || "Nu am putut plasa comanda.");
        return;
      }

      setCreatedOrder(data.order);
      setMessageType("success");
      setMessage("Comanda a fost plasată cu succes.");

      clearCart();

      loadDeliveryEstimate({
        cleanCustomerData,
        productsForEstimate,
        totalPrice: totalPriceForEstimate,
        orderId: data.order?._id,
      });

      setCustomerData({
        name: session?.user?.name || "",
        phone: profileData?.phone || "",
        city: profileData?.city || "Brașov",
        street: profileData?.street || "",
        streetNumber: profileData?.streetNumber || "",
        building: profileData?.building || "",
        entrance: profileData?.entrance || "",
        floor: profileData?.floor || "",
        apartment: profileData?.apartment || "",
        notes: profileData?.defaultNotes || "",
      });

      setSelectedStreet(null);
      setStreetSuggestions([]);
      setStreetDropdownOpen(false);
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("A apărut o eroare la plasarea comenzii.");
    } finally {
      setPlacingOrder(false);
    }
  }

  if (createdOrder) {
    const aiPrediction = deliveryEstimate?.aiPrediction;

    return (
      <section className="mt-8">
        <div className="text-center mb-10">
          <SectionHeaders
            subHeader="comandă trimisă"
            mainHeader="Mulțumim!"
          />
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-sm max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🍕</div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Comanda ta a fost plasată cu succes.
            </h2>

            <p className="text-gray-600 mb-3">Număr comandă:</p>

            <p className="font-bold text-primary break-all mb-6">
              {shortOrderId(createdOrder._id)}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-100 rounded-2xl p-5">
              <p className="text-gray-500 text-sm mb-1">Status</p>
              <p className="font-bold text-gray-900">{createdOrder.status}</p>
            </div>

            <div className="bg-gray-100 rounded-2xl p-5">
              <p className="text-gray-500 text-sm mb-1">Total comandă</p>
              <p className="font-bold text-primary text-xl">
                {formatMoney(createdOrder.totalPrice)}
              </p>
            </div>

            <div className="bg-gray-100 rounded-2xl p-5">
              <p className="text-gray-500 text-sm mb-1">Plată</p>
              <p className="font-bold text-gray-900">
                {createdOrder.paid ? "Plătită" : "Neachitată"}
              </p>
            </div>
          </div>

          <div className="bg-orange-50 border border-primary/20 rounded-3xl p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <p className="text-sm uppercase tracking-wide text-primary font-bold">
                    Estimare livrare
                  </p>

                  <span className="bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-bold">
                    Mod inteligent
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900">
                  Ruta de livrare și estimarea inteligentă
                </h3>

                <p className="text-gray-600 mt-2">
                  Comanda {shortOrderId(createdOrder._id)} este analizată pe
                  baza produselor comandate, a distanței și a traseului de
                  livrare.
                </p>
              </div>

              {deliveryEstimate && (
                <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-primary/10">
                  <p className="text-gray-500 text-sm">Timp estimativ</p>
                  <p className="text-3xl font-bold text-primary">
                    {formatMinutes(deliveryEstimate.estimatedDeliveryMinutes)}
                  </p>
                </div>
              )}
            </div>

            {deliveryLoading && (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-600 font-semibold">
                Se calculează ruta și estimarea de livrare...
              </div>
            )}

            {deliveryError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5 font-semibold">
                {deliveryError}
              </div>
            )}

            {deliveryEstimate && (
              <div className="flex flex-col gap-5">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Pregătire estimată</p>
                    <p className="font-bold text-gray-900">
                      {formatMinutes(deliveryEstimate.preparationMinutes)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Drum hartă</p>
                    <p className="font-bold text-gray-900">
                      {formatMinutes(deliveryEstimate.drivingMinutes)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Distanță</p>
                    <p className="font-bold text-gray-900">
                      {formatDistanceKm(deliveryEstimate.distanceKm)}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm">Sosire estimată</p>
                    <p className="font-bold text-gray-900">
                      {formatDateTime(deliveryEstimate.estimatedArrival)}
                    </p>
                  </div>
                </div>

                {aiPrediction && (
                  <div className="bg-white rounded-3xl p-5 border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-primary font-bold">
                          Analiză livrare
                        </p>

                        <h4 className="text-xl font-bold text-gray-900">
                          Predicție inteligentă de livrare
                        </h4>
                      </div>

                      <div
                        className={`rounded-full px-4 py-2 text-sm font-bold border ${getRiskClass(
                          aiPrediction.riskLevel
                        )}`}
                      >
                        {getRiskLabel(aiPrediction.riskLevel)}
                      </div>
                    </div>

                    <p className="text-gray-600 leading-7 mb-4">
                      {aiPrediction.reason}
                    </p>

                    <div className="grid md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-gray-500 text-sm">
                          Marjă livrare
                        </p>
                        <p className="font-bold text-gray-900">
                          {formatMinutes(aiPrediction.deliveryBufferMinutes)}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-gray-500 text-sm">Sursă estimare</p>
                        <p className="font-bold text-gray-900">
                          {aiPrediction.aiUsed ? "Motor inteligent" : "Reguli interne"}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-2xl p-4">
                        <p className="text-gray-500 text-sm">Total estimat</p>
                        <p className="font-bold text-primary">
                          {formatMinutes(aiPrediction.estimatedDeliveryMinutes)}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(aiPrediction.factors) &&
                      aiPrediction.factors.length > 0 && (
                        <div>
                          <p className="font-bold text-gray-900 mb-2">
                            Factori analizați:
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {aiPrediction.factors.map((factor, index) => (
                              <span
                                key={`${factor}-${index}`}
                                className="bg-gray-100 rounded-full px-4 py-2 text-sm font-semibold text-gray-700"
                              >
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                <DeliveryRouteMap
                  route={deliveryEstimate.route}
                  restaurant={deliveryEstimate.restaurant}
                  customer={deliveryEstimate.customer}
                  distanceKm={deliveryEstimate.distanceKm}
                  drivingMinutes={deliveryEstimate.drivingMinutes}
                  estimatedArrival={deliveryEstimate.estimatedArrival}
                />

                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="font-bold text-gray-900 mb-1">Restaurant</p>
                    <p>{deliveryEstimate.restaurant.displayName}</p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="font-bold text-gray-900 mb-1">Client</p>
                    <p>{deliveryEstimate.customer.displayName}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/menu"
              className="bg-primary text-white rounded-full px-8 py-3 font-bold text-center"
            >
              Înapoi la meniu
            </Link>

            <Link
              href="/my-orders"
              className="border border-gray-300 text-gray-700 rounded-full px-8 py-3 font-bold text-center"
            >
              Comenzile mele
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="text-center mb-10">
        <SectionHeaders subHeader="verifică produsele" mainHeader="Coșul tău" />
      </div>

      {cartProducts.length === 0 ? (
        <div className="text-center bg-white rounded-2xl p-10 shadow-sm">
          <p className="text-gray-600 mb-6">
            Coșul tău este gol. Alege produsele preferate din meniu și revino
            aici pentru finalizarea comenzii.
          </p>

          <Link
            href="/menu"
            className="inline-block bg-primary text-white rounded-full px-8 py-3 font-bold"
          >
            Înapoi la meniu
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10">
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-6">Produse adăugate</h2>

              <div className="flex flex-col gap-5">
                {groupedProducts.map(({ product, quantity }) => {
                  const productTotal = getOrderProductLineTotal({ ...product, quantity });

                  return (
                    <div
                      key={product._id}
                      className="flex gap-4 items-center border-b border-gray-100 pb-5"
                    >
                      <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                        <Image
                          src={product.image || "/pizza.png"}
                          width={96}
                          height={96}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{product.name}</h3>

                        <p className="text-gray-500 text-sm">
                          {formatMoney(getOrderProductUnitPrice(product))} / bucată
                        </p>

                        <button
                          type="button"
                          onClick={() => removeAllFromCart(product._id)}
                          className="!w-auto border-0 p-0 mt-2 text-sm text-red-500 underline"
                        >
                          Șterge produsul
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => removeOneFromCart(product._id)}
                          className="!w-9 !h-9 border border-gray-300 rounded-full p-0 flex items-center justify-center"
                        >
                          -
                        </button>

                        <span className="font-bold w-6 text-center">
                          {quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="!w-9 !h-9 border border-gray-300 rounded-full p-0 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      <div className="font-bold min-w-[80px] text-right">
                        {formatMoney(productTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-8">
                <button
                  type="button"
                  onClick={clearCart}
                  className="!w-auto border border-gray-300 rounded-full px-6 py-2 text-gray-600"
                >
                  Golește coșul
                </button>

                <div className="text-xl font-bold">
                  Total: <span className="text-primary">{formatMoney(cartTotal)}</span>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-3xl p-6 border border-primary/20 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <p className="text-sm uppercase tracking-wide text-primary font-bold">
                      Recomandări în coș
                    </p>

                    <span className="bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-bold">
                      Mod inteligent
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900">
                    Completează comanda inteligent
                  </h2>

                  <p className="text-gray-600 mt-2 leading-7">
                    Sistemul inteligent analizează produsele din coș și îți propune
                    recomandări potrivite pentru comandă: băuturi, deserturi
                    sau produse complementare, în funcție de selecția curentă.
                  </p>
                </div>

                {cartRecommendationSource && (
                  <div className="bg-white rounded-2xl px-4 py-3 border border-primary/10">
                    <p className="text-gray-500 text-xs">Sursă</p>
                    <p className="font-bold text-gray-900">
                      {cartRecommendationSource}
                    </p>
                  </div>
                )}
              </div>

              {recommendationsLoading && (
                <div className="bg-white rounded-2xl p-5 text-center text-gray-600 font-semibold">
                  Se generează recomandări personalizate...
                </div>
              )}

              {recommendationsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-semibold">
                  {recommendationsError}
                </div>
              )}

              {!recommendationsLoading &&
                !recommendationsError &&
                cartRecommendations.length === 0 && (
                  <div className="bg-white rounded-2xl p-5 text-gray-500">
                    Momentan nu există recomandări disponibile pentru coșul
                    curent.
                  </div>
                )}

              {!recommendationsLoading && cartRecommendations.length > 0 && (
                <div className="flex flex-col gap-5">
                  {cartRecommendationSummary && (
                    <div className="bg-white/70 border border-primary/10 rounded-2xl p-4">
                      <p className="text-gray-600 leading-7">
                        {cartRecommendationSummary}
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-5 items-stretch">
                    {cartRecommendations.map((recommendation) => (
                      <RecommendationCard
                        key={recommendation.product._id}
                        recommendation={recommendation}
                        onAdd={addToCart}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-fit lg:sticky lg:top-6">
            <h2 className="text-2xl font-bold mb-3">Date pentru checkout</h2>

            {profileLoading && (
              <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 font-semibold">
                Se încarcă datele din profil...
              </div>
            )}

            {!profileLoading && profileAutoFilled && profileData && (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    Datele de checkout au fost completate din profil.
                  </span>

                  <button
                    type="button"
                    onClick={() => applyProfileToCheckout(profileData, true)}
                    className="!w-auto border border-green-300 bg-white text-green-700 rounded-full px-4 py-2 text-xs font-bold"
                  >
                    Reîncarcă
                  </button>
                </div>
              </div>
            )}

            {!profileData && status === "authenticated" && !profileLoading && (
              <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                Nu ai date salvate în profil. Le poți completa în pagina de
                profil pentru checkout automat.
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                name="name"
                placeholder="Nume complet"
                value={customerData.name}
                onChange={handleInputChange}
                required
                maxLength={120}
              />

              <input
                type="tel"
                name="phone"
                placeholder="Telefon"
                value={customerData.phone}
                onChange={handleInputChange}
                required
                inputMode="tel"
                maxLength={20}
              />

              <input
                type="text"
                name="city"
                placeholder="Oraș"
                value={customerData.city}
                onChange={handleInputChange}
                required
                maxLength={80}
              />

              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="relative">
                  <input
                    type="text"
                    name="street"
                    placeholder="Stradă, ex: Strada Rozelor"
                    value={customerData.street}
                    onChange={handleInputChange}
                    onFocus={() => setStreetDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setStreetDropdownOpen(false);
                      }, 180);
                    }}
                    autoComplete="off"
                    required
                    maxLength={140}
                  />

                  {streetDropdownOpen && customerData.street.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                      {streetLoading && (
                        <div className="px-4 py-4 text-sm text-gray-500">
                          Se caută străzi...
                        </div>
                      )}

                      {!streetLoading && streetError && (
                        <div className="px-4 py-4 text-sm text-red-600">
                          {streetError}
                        </div>
                      )}

                      {!streetLoading &&
                        !streetError &&
                        streetSuggestions.length === 0 && (
                          <div className="px-4 py-4 text-sm text-gray-500">
                            Nu am găsit străzi clare pentru textul introdus.
                          </div>
                        )}

                      {!streetLoading &&
                        !streetError &&
                        streetSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => handleStreetSelect(suggestion)}
                            className="!w-full border-0 rounded-none bg-white px-4 py-3 text-left hover:bg-orange-50 transition"
                          >
                            <span className="block font-bold text-gray-900">
                              {suggestion.label}
                            </span>

                            {suggestion.secondary && (
                              <span className="block text-sm text-gray-500 mt-1">
                                {suggestion.secondary}
                              </span>
                            )}

                            <span className="block text-xs text-gray-400 mt-1 truncate">
                              {suggestion.fullAddress}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  name="streetNumber"
                  placeholder="Nr."
                  value={customerData.streetNumber}
                  onChange={handleInputChange}
                  autoComplete="off"
                  required
                  maxLength={20}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="building"
                  placeholder="Bloc"
                  value={customerData.building}
                  onChange={handleInputChange}
                />

                <input
                  type="text"
                  name="entrance"
                  placeholder="Scară"
                  value={customerData.entrance}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="floor"
                  placeholder="Etaj"
                  value={customerData.floor}
                  onChange={handleInputChange}
                />

                <input
                  type="text"
                  name="apartment"
                  placeholder="Apartament"
                  value={customerData.apartment}
                  onChange={handleInputChange}
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p className="font-semibold text-gray-900 mb-1">
                  Adresă completă
                </p>

                <p>
                  {fullAddressPreview ||
                    "Completează strada și numărul pentru afișarea adresei."}
                </p>
              </div>

              {selectedStreet && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  Stradă selectată:{" "}
                  <span className="font-semibold">{selectedStreet.label}</span>
                </div>
              )}

              <textarea
                name="notes"
                placeholder="Observații pentru comandă"
                value={customerData.notes}
                onChange={handleInputChange}
                rows={4}
                className="block w-full my-2 rounded-xl border p-3 border-gray-300 bg-gray-100"
              />

              <div className="bg-gray-100 rounded-xl p-4 my-4">
                <div className="flex justify-between mb-2">
                  <span>Produse</span>
                  <span>{cartProducts.length}</span>
                </div>

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatMoney(cartTotal)}</span>
                </div>
              </div>

              {checkoutDisabled && cartProducts.length > 0 && !placingOrder && (
                <p className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-700">
                  Completează numele, telefonul valid, orașul, strada și numărul pentru a plasa comanda.
                </p>
              )}

              <button
                type="submit"
                disabled={checkoutDisabled}
                className="bg-primary text-white border-0 rounded-full px-8 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {placingOrder ? "Se plasează comanda..." : "Plasează comanda"}
              </button>

              {message && (
                <p
                  className={
                    messageType === "success"
                      ? "text-center text-sm text-green-600 font-semibold mt-3"
                      : "text-center text-sm text-red-600 font-semibold mt-3"
                  }
                >
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}