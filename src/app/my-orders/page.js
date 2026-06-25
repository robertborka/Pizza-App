"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SectionHeaders from "../components/layout/sectionHeaders";
import UserTabs from "../components/layout/userTabs";
import { formatDateTime, formatMinutes, formatMoney } from "@/libs/formatters";
import {
  getOrderProductLineTotal,
  getOrderProductQuantity,
  getOrderProductUnitPrice,
  getOrderTotal,
} from "@/libs/orderUtils";

const ORDER_STEPS = [
  {
    key: "Nouă",
    label: "Comandă primită",
    icon: "🧾",
    description: "Comanda a fost înregistrată.",
  },
  {
    key: "În pregătire",
    label: "În pregătire",
    icon: "🍕",
    description: "Produsele sunt pregătite.",
  },
  {
    key: "Pe drum",
    label: "Pe drum",
    icon: "🛵",
    description: "Comanda este în livrare.",
  },
  {
    key: "Livrată",
    label: "Livrată",
    icon: "✅",
    description: "Comanda a fost livrată.",
  },
];

function shortOrderId(orderId) {
  if (!orderId) {
    return "";
  }

  return `#${String(orderId).slice(-6).toUpperCase()}`;
}

function normalizeOrdersResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.orders)) {
    return data.orders;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

function getStatusIndex(status) {
  const index = ORDER_STEPS.findIndex((step) => step.key === status);

  if (index === -1) {
    return 0;
  }

  return index;
}

function getStatusBadgeClass(status) {
  if (status === "Livrată") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "Pe drum") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (status === "În pregătire") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  if (status === "Anulată") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-gray-100 text-gray-700 border-gray-200";
}

function getDeliveryText(order) {
  const estimate = order.deliveryEstimate;

  if (!estimate) {
    return "Estimare indisponibilă";
  }

  if (estimate.estimatedDeliveryMinutes) {
    return formatMinutes(estimate.estimatedDeliveryMinutes);
  }

  return "Estimare calculată";
}

function OrderProgress({ status }) {
  if (status === "Anulată") {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center text-2xl">
            ✕
          </div>

          <div>
            <h4 className="font-bold text-red-800 text-lg">
              Comanda a fost anulată
            </h4>

            <p className="text-red-700 text-sm leading-6 mt-1">
              Această comandă nu mai este activă. Pentru o nouă comandă, poți
              reveni în meniu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = getStatusIndex(status);
  const progressPercent = (activeIndex / (ORDER_STEPS.length - 1)) * 100;

  return (
    <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
      <div className="relative">
        <div className="absolute left-0 right-0 top-6 h-1 rounded-full bg-gray-200" />

        <div
          className="absolute left-0 top-6 h-1 rounded-full bg-primary transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
          }}
        />

        <div className="relative grid grid-cols-4 gap-2">
          {ORDER_STEPS.map((step, index) => {
            const completed = index <= activeIndex;
            const current = index === activeIndex;

            return (
              <div key={step.key} className="text-center">
                <div
                  className={
                    completed
                      ? "mx-auto w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center text-xl shadow-md shadow-primary/20"
                      : "mx-auto w-12 h-12 rounded-2xl bg-white text-gray-400 border border-gray-200 flex items-center justify-center text-xl"
                  }
                >
                  {step.icon}
                </div>

                <p
                  className={
                    current
                      ? "font-bold text-primary text-sm mt-3"
                      : completed
                      ? "font-bold text-gray-900 text-sm mt-3"
                      : "font-semibold text-gray-400 text-sm mt-3"
                  }
                >
                  {step.label}
                </p>

                <p className="hidden md:block text-xs text-gray-500 mt-1 leading-5">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderProducts({ products }) {
  if (!Array.isArray(products) || products.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        Produsele nu sunt disponibile pentru această comandă.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((product, index) => {
        const quantity = getOrderProductQuantity(product);
        const price = getOrderProductUnitPrice(product);
        const productTotal = getOrderProductLineTotal(product);

        return (
          <div
            key={`${product.productId || product._id || product.name}-${index}`}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3"
          >
            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
              <Image
                src={product.image || "/pizza.png"}
                width={64}
                height={64}
                alt={product.name || "Produs"}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">
                {product.name || "Produs"}
              </p>

              <p className="text-sm text-gray-500">
                {quantity} x {formatMoney(price)}
              </p>
            </div>

            <p className="font-bold text-primary shrink-0">
              {formatMoney(productTotal)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order }) {
  const status = order.status || "Nouă";

  return (
    <article className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 md:p-7 border-b border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-primary font-bold text-lg">
                {shortOrderId(order._id)}
              </span>

              <span
                className={`rounded-full border px-4 py-2 text-sm font-bold ${getStatusBadgeClass(
                  status
                )}`}
              >
                {status}
              </span>

              <span className="rounded-full bg-gray-100 text-gray-600 px-4 py-2 text-sm font-semibold">
                {order.paid ? "Plătită" : "Neachitată"}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-gray-900">
              Comandă plasată pe {formatDateTime(order.createdAt)}
            </h3>

            <p className="text-gray-500 mt-2">
              {order.customerName || "Client"} • {order.phone || "Telefon lipsă"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-orange-50 border border-primary/10 px-4 py-3">
              <p className="text-gray-500 text-sm">Total</p>
              <p className="font-bold text-primary text-2xl">
                {formatMoney(getOrderTotal(order))}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-gray-500 text-sm">Livrare</p>
              <p className="font-bold text-gray-900">{getDeliveryText(order)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-7">
        <OrderProgress status={status} />

        <div className="grid lg:grid-cols-[1fr_0.9fr] gap-6 mt-6">
          <div>
            <h4 className="font-bold text-gray-900 text-lg mb-4">
              Produse comandate
            </h4>

            <OrderProducts products={order.products} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-5">
              <h4 className="font-bold text-gray-900 mb-3">
                Adresa de livrare
              </h4>

              <p className="text-gray-600 leading-7">
                {order.address || "Adresa nu este disponibilă."}
              </p>

              {order.city && (
                <p className="text-gray-500 text-sm mt-2">Oraș: {order.city}</p>
              )}
            </div>

            {order.notes && (
              <div className="rounded-3xl bg-orange-50 border border-primary/10 p-5">
                <h4 className="font-bold text-gray-900 mb-3">
                  Observații comandă
                </h4>

                <p className="text-gray-600 leading-7">{order.notes}</p>
              </div>
            )}

            {order.deliveryEstimate?.estimatedArrival && (
              <div className="rounded-3xl bg-green-50 border border-green-200 p-5">
                <h4 className="font-bold text-green-800 mb-2">
                  Sosire estimată
                </h4>

                <p className="text-green-700 font-semibold">
                  {formatDateTime(order.deliveryEstimate.estimatedArrival)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MyOrdersPage() {
  const { status } = useSession();
  const router = useRouter();

  const previousStatusesRef = useRef(new Map());

  const [orders, setOrders] = useState([]);
  const [profileIsAdmin, setProfileIsAdmin] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");
  const [statusNotification, setStatusNotification] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function loadOrders({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoadingOrders(true);
      }

      setError("");

      const [ordersRes, profileRes] = await Promise.all([
        fetch("/api/orders", {
          cache: "no-store",
        }),
        fetch("/api/profile", {
          cache: "no-store",
        }).catch(() => null),
      ]);

      const ordersData = await ordersRes.json();

      if (!ordersRes.ok) {
        setError(ordersData.error || "Nu am putut încărca comenzile.");
        setOrders([]);
        return;
      }

      if (profileRes?.ok) {
        const profileData = await profileRes.json();
        setProfileIsAdmin(Boolean(profileData.admin));
      }

      const nextOrders = normalizeOrdersResponse(ordersData);

      const previousStatuses = previousStatusesRef.current;

      for (const order of nextOrders) {
        const orderId = String(order._id);
        const previousStatus = previousStatuses.get(orderId);

        if (previousStatus && previousStatus !== order.status) {
          setStatusNotification(
            `Status actualizat pentru ${shortOrderId(orderId)}: ${order.status}`
          );

          setTimeout(() => {
            setStatusNotification("");
          }, 4500);
        }

        previousStatuses.set(orderId, order.status);
      }

      setOrders(nextOrders);
    } catch (err) {
      console.error(err);
      setError("A apărut o eroare la încărcarea comenzilor.");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    loadOrders({ silent: false });

    const intervalId = setInterval(() => {
      loadOrders({ silent: true });
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [status]);

  const activeOrders = useMemo(() => {
    return orders.filter(
      (order) => order.status !== "Livrată" && order.status !== "Anulată"
    );
  }, [orders]);

  const finishedOrders = useMemo(() => {
    return orders.filter(
      (order) => order.status === "Livrată" || order.status === "Anulată"
    );
  }, [orders]);

  if (status === "loading" || loadingOrders) {
    return (
      <section className="mt-8">
        <div className="text-center mb-8">
          <UserTabs isAdmin={false} />
        </div>

        <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-gray-100 text-center">
          <p className="font-semibold text-gray-500">
            Se încarcă comenzile...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-8 pb-16">
      <div className="absolute -left-24 top-32 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-24 top-96 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

      {statusNotification && (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-gray-950 text-white px-6 py-4 shadow-2xl border border-white/10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            🔔
          </span>

          <span className="font-bold">{statusNotification}</span>
        </div>
      )}

      <div className="relative text-center mb-8">
        <UserTabs isAdmin={profileIsAdmin} />
      </div>

      <div className="relative text-center mb-10">
        <SectionHeaders subHeader="status comenzi" mainHeader="Comenzile mele" />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Urmărește statusul comenzilor tale, produsele comandate și estimarea de
          livrare. Pagina se actualizează automat periodic.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center font-semibold mb-8">
          {error}
        </div>
      )}

      {!error && orders.length === 0 && (
        <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm text-center">
          <div className="text-6xl mb-5">🧾</div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Nu ai comenzi momentan.
          </h2>

          <p className="text-gray-500 mb-7">
            Alege produsele preferate din meniu și plasează prima comandă.
          </p>

          <Link
            href="/menu"
            className="inline-block bg-primary text-white rounded-full px-8 py-3 font-bold"
          >
            Vezi meniul
          </Link>
        </div>
      )}

      {!error && orders.length > 0 && (
        <div className="space-y-12">
          {activeOrders.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="text-2xl font-bold text-gray-900">
                  Comenzi active
                </h2>

                <button
                  type="button"
                  onClick={() => loadOrders({ silent: false })}
                  className="!w-auto border border-gray-300 bg-white text-gray-700 rounded-full px-5 py-3 font-bold hover:border-primary hover:text-primary transition"
                >
                  Actualizează
                </button>
              </div>

              <div className="space-y-6">
                {activeOrders.map((order) => (
                  <OrderCard key={order._id} order={order} />
                ))}
              </div>
            </div>
          )}

          {finishedOrders.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-5">
                Istoric comenzi
              </h2>

              <div className="space-y-6">
                {finishedOrders.map((order) => (
                  <OrderCard key={order._id} order={order} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}