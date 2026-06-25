"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";
import { formatDateTime, formatDistanceKm, formatMinutes, formatMoney } from "@/libs/formatters";
import {
  getOrderProductLineTotal,
  getOrderProductQuantity,
  getOrderProductUnitPrice,
  getOrderTotal,
} from "@/libs/orderUtils";

const statuses = ["Nouă", "În pregătire", "Pe drum", "Livrată", "Anulată"];

const orderSteps = [
  { key: "Nouă", label: "Plasată" },
  { key: "În pregătire", label: "Pregătire" },
  { key: "Pe drum", label: "Livrare" },
  { key: "Livrată", label: "Livrată" },
];

function getArrayFromResponse(data, key) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[key])) {
    return data[key];
  }

  return [];
}

function shortOrderId(orderId) {
  if (!orderId) {
    return "";
  }

  return `#${String(orderId).slice(-6).toUpperCase()}`;
}

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

function getOrderStepIndex(status) {
  const index = orderSteps.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

function OrderTimeline({ status }) {
  if (status === "Anulată") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
        Comanda este anulată.
      </div>
    );
  }

  const activeIndex = getOrderStepIndex(status);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="grid grid-cols-4 gap-2">
        {orderSteps.map((step, index) => {
          const active = index <= activeIndex;

          return (
            <div key={step.key} className="text-center">
              <div
                className={
                  active
                    ? "mx-auto mb-2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black"
                    : "mx-auto mb-2 h-8 w-8 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center text-xs font-black"
                }
              >
                {index + 1}
              </div>
              <p className={active ? "text-xs font-bold text-gray-900" : "text-xs font-semibold text-gray-400"}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
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

export default function OrdersPage() {
  const { status } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadProfileAndOrders() {
      if (status !== "authenticated") {
        return;
      }

      try {
        setProfileFetched(false);

        const profileRes = await fetch("/api/profile", {
          cache: "no-store",
        });

        const profileData = await profileRes.json();

        if (!profileRes.ok) {
          setMessage(profileData.error || "Nu am putut verifica profilul.");
          setMessageType("error");
          setAdmin(false);
          return;
        }

        const isAdmin = Boolean(profileData.admin);
        setAdmin(isAdmin);

        if (!isAdmin) {
          router.push("/profile");
          return;
        }

        await loadOrders();
      } catch (error) {
        console.error(error);
        setMessage("A apărut o eroare la verificarea profilului.");
        setMessageType("error");
      } finally {
        setProfileFetched(true);
      }
    }

    loadProfileAndOrders();
  }, [status, router]);

  async function loadOrders() {
    try {
      setLoadingOrders(true);
      setMessage("");
      setMessageType("");

      const res = await fetch("/api/orders", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut încărca comenzile.");
        setMessageType("error");
        setOrders([]);
        return;
      }

      setOrders(getArrayFromResponse(data, "orders"));
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea comenzilor.");
      setMessageType("error");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateOrder(orderId, updateData) {
    try {
      setUpdatingId(orderId);
      setMessage("");
      setMessageType("");

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut actualiza comanda.");
        setMessageType("error");
        return;
      }

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId
            ? {
                ...order,
                ...updateData,
              }
            : order
        )
      );

      setMessage("Comanda a fost actualizată.");
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la actualizarea comenzii.");
      setMessageType("error");
    } finally {
      setUpdatingId("");
    }
  }

  if (status === "loading" || !profileFetched) {
    return <section className="mt-8 text-center">Se încarcă...</section>;
  }

  if (!admin) {
    return (
      <section className="mt-8 text-center">
        Nu ai acces la această pagină.
      </section>
    );
  }

  return (
    <section className="mt-8">
      <UserTabs isAdmin={admin} />

      <div className="text-center mb-10">
        <SectionHeaders subHeader="administrare" mainHeader="Comenzi" />

        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Aici apar comenzile plasate de clienți, statusul lor, produsele,
          adresa, totalul și estimarea inteligentă de livrare.
        </p>
      </div>

      {message && (
        <div
          className={
            messageType === "success"
              ? "max-w-5xl mx-auto mb-6 rounded-xl bg-green-100 text-green-700 border border-green-200 px-4 py-3 text-sm font-semibold"
              : "max-w-5xl mx-auto mb-6 rounded-xl bg-red-100 text-red-700 border border-red-200 px-4 py-3 text-sm font-semibold"
          }
        >
          {message}
        </div>
      )}

      {loadingOrders ? (
        <p className="text-center text-gray-500">Se încarcă comenzile...</p>
      ) : orders.length === 0 ? (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-10 text-center shadow-sm">
          <p className="text-gray-500">Nu există comenzi momentan.</p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col gap-7">
          {orders.map((order) => {
            const deliveryEstimate = order.deliveryEstimate;
            const aiPrediction = deliveryEstimate?.aiPrediction;

            return (
              <div
                key={order._id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        Comanda {shortOrderId(order._id)}
                      </h2>

                      <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold">
                        {order.status}
                      </span>

                      <span className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-bold">
                        {order.paid ? "Plătită" : "Neplătită"}
                      </span>
                    </div>

                    <p className="text-gray-500 text-sm">
                      Data: {formatDateTime(order.createdAt)}
                    </p>

                    <p className="text-gray-500 text-sm">
                      Email utilizator: {order.userEmail || "-"}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-gray-500 text-sm">Total comandă</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatMoney(getOrderTotal(order))}
                    </p>
                  </div>
                </div>

                <div className="mb-5">
                  <OrderTimeline status={order.status} />
                </div>

                <div className="grid md:grid-cols-2 gap-5 mb-5">
                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Date client
                    </h3>

                    <p>
                      <span className="font-bold">Nume:</span>{" "}
                      {order.customerName || "-"}
                    </p>

                    <p>
                      <span className="font-bold">Telefon:</span>{" "}
                      {order.phone || "-"}
                    </p>

                    <p>
                      <span className="font-bold">Oraș:</span>{" "}
                      {order.city || "-"}
                    </p>

                    <p>
                      <span className="font-bold">Adresă:</span>{" "}
                      {order.address || "-"}
                    </p>

                    {order.notes && (
                      <p>
                        <span className="font-bold">Observații:</span>{" "}
                        {order.notes}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-5">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Administrare comandă
                    </h3>

                    <label className="font-semibold text-gray-700 text-sm">
                      Status comandă
                    </label>

                    <select
                      value={order.status}
                      disabled={updatingId === order._id}
                      onChange={(ev) =>
                        updateOrder(order._id, {
                          status: ev.target.value,
                        })
                      }
                      className="block w-full my-2 rounded-xl border p-2 border-gray-300 bg-white"
                    >
                      {statuses.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-3 mt-5 font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(order.paid)}
                        disabled={updatingId === order._id}
                        onChange={(ev) =>
                          updateOrder(order._id, {
                            paid: ev.target.checked,
                          })
                        }
                      />
                      Comanda este plătită
                    </label>

                    {updatingId === order._id && (
                      <p className="text-sm text-gray-500 mt-3">
                        Se actualizează...
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 mb-5">
                  <h3 className="font-bold text-gray-900 mb-4">
                    Produse comandate
                  </h3>

                  {order.products?.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {order.products.map((product, index) => (
                        <div
                          key={`${product.productId}-${index}`}
                          className="flex justify-between gap-3 bg-white rounded-xl p-3 border border-gray-100"
                        >
                          <div>
                            <p className="font-bold text-gray-900">
                              {getOrderProductQuantity(product)} x {product.name || "Produs"}
                            </p>

                            <p className="text-sm text-gray-500">
                              {formatMoney(getOrderProductUnitPrice(product))} / bucată
                            </p>
                          </div>

                          <p className="font-bold text-primary">
                            {formatMoney(getOrderProductLineTotal(product))}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Nu există produse afișate.</p>
                  )}
                </div>

                {deliveryEstimate ? (
                  <div className="bg-orange-50 border border-primary/20 rounded-3xl p-5">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <p className="text-sm uppercase tracking-wide text-primary font-bold">
                            Estimare livrare
                          </p>

                          <span className="bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-bold">
                            Mod inteligent
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900">
                          Estimare pentru comanda {shortOrderId(order._id)}
                        </h3>
                      </div>

                      <div className="bg-white rounded-2xl px-5 py-4 border border-primary/10">
                        <p className="text-gray-500 text-sm">
                          Timp estimativ
                        </p>

                        <p className="text-3xl font-bold text-primary">
                          {formatMinutes(deliveryEstimate.estimatedDeliveryMinutes)}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-500 text-sm">Pregătire estimată</p>
                        <p className="font-bold">
                          {formatMinutes(deliveryEstimate.preparationMinutes)}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-500 text-sm">Drum hartă</p>
                        <p className="font-bold">
                          {formatMinutes(deliveryEstimate.drivingMinutes)}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-500 text-sm">Distanță</p>
                        <p className="font-bold">
                          {formatDistanceKm(deliveryEstimate.distanceKm)}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-500 text-sm">
                          Sosire estimată
                        </p>

                        <p className="font-bold">
                          {formatDateTime(deliveryEstimate.estimatedArrival)}
                        </p>
                      </div>
                    </div>

                    {aiPrediction && (
                      <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                          <h4 className="font-bold text-gray-900">
                            Analiză livrare
                          </h4>

                          <span
                            className={`rounded-full px-4 py-2 text-sm font-bold border ${getRiskClass(
                              aiPrediction.riskLevel
                            )}`}
                          >
                            {getRiskLabel(aiPrediction.riskLevel)}
                          </span>
                        </div>

                        <p className="text-gray-600 leading-7 mb-3">
                          {aiPrediction.reason}
                        </p>

                        <div className="grid md:grid-cols-3 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-gray-500 text-sm">
                              Marjă livrare
                            </p>

                            <p className="font-bold">
                              {formatMinutes(aiPrediction.deliveryBufferMinutes)}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-gray-500 text-sm">
                              Sursă estimare
                            </p>

                            <p className="font-bold">
                              {aiPrediction.aiUsed
                                ? "Motor inteligent"
                                : "Reguli interne"}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-2xl p-4">
                            <p className="text-gray-500 text-sm">
                              Total estimat
                            </p>

                            <p className="font-bold text-primary">
                              {formatMinutes(aiPrediction.estimatedDeliveryMinutes)}
                            </p>
                          </div>
                        </div>

                        {Array.isArray(aiPrediction.factors) &&
                          aiPrediction.factors.length > 0 && (
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
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-5 text-gray-500">
                    Estimarea inteligentă de livrare nu este disponibilă pentru această
                    comandă.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}