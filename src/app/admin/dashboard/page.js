"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SectionHeaders from "../../components/layout/sectionHeaders";
import UserTabs from "../../components/layout/userTabs";

async function readJsonResponse(res) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 220);

    throw new Error(
      `Răspunsul primit nu este JSON. Status: ${res.status}. Preview: ${preview}`
    );
  }
}

function formatDateTime(dateString) {
  if (!dateString) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(0)} lei`;
}

function shortOrderId(orderId) {
  if (!orderId) {
    return "";
  }

  return `#${String(orderId).slice(-6).toUpperCase()}`;
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

function maxValue(items, key) {
  const values = items.map((item) => Number(item[key] || 0));
  return Math.max(...values, 1);
}

function StatCard({ title, value, subtitle, icon, dark = false }) {
  return (
    <div
      className={
        dark
          ? "relative overflow-hidden rounded-[2rem] bg-gray-950 text-white p-6 border border-gray-900 shadow-sm"
          : "relative overflow-hidden rounded-[2rem] bg-white p-6 border border-gray-100 shadow-sm"
      }
    >
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className={dark ? "text-white/60 text-sm" : "text-gray-500 text-sm"}>
            {title}
          </p>

          <p
            className={
              dark
                ? "text-3xl font-bold text-white mt-2"
                : "text-3xl font-bold text-gray-900 mt-2"
            }
          >
            {value}
          </p>

          {subtitle && (
            <p
              className={
                dark
                  ? "text-white/60 text-sm mt-2"
                  : "text-gray-500 text-sm mt-2"
              }
            >
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={
            dark
              ? "w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl"
              : "w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl"
          }
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function BarChart({ title, items, valueKey, labelKey, formatter }) {
  const safeItems = Array.isArray(items) ? items : [];
  const max = maxValue(safeItems, valueKey);

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
      <h3 className="font-bold text-xl text-gray-900 mb-5">{title}</h3>

      {safeItems.length === 0 ? (
        <p className="text-gray-500">Nu există date disponibile.</p>
      ) : (
        <div className="space-y-4">
          {safeItems.map((item) => {
            const value = Number(item[valueKey] || 0);
            const width = Math.max((value / max) * 100, value > 0 ? 8 : 0);

            return (
              <div key={item[labelKey]}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-gray-700">
                    {item[labelKey]}
                  </span>

                  <span className="font-bold text-gray-900">
                    {formatter ? formatter(value) : value}
                  </span>
                </div>

                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${width}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopProducts({ products }) {
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
      <h3 className="font-bold text-xl text-gray-900 mb-5">
        Top produse vândute
      </h3>

      {safeProducts.length === 0 ? (
        <p className="text-gray-500">Nu există produse vândute momentan.</p>
      ) : (
        <div className="space-y-4">
          {safeProducts.map((product, index) => (
            <div
              key={product.name}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shrink-0">
                {index + 1}
              </div>

              <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex items-center justify-center shrink-0">
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
                  {product.name}
                </p>

                <p className="text-sm text-gray-500">
                  {product.quantity} bucăți vândute
                </p>
              </div>

              <p className="font-bold text-primary shrink-0">
                {formatMoney(product.revenue)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentOrders({ orders }) {
  const safeOrders = Array.isArray(orders) ? orders : [];

  return (
    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="font-bold text-xl text-gray-900">Ultimele comenzi</h3>

        <Link href="/admin/orders" className="text-primary font-bold text-sm">
          Vezi toate
        </Link>
      </div>

      {safeOrders.length === 0 ? (
        <p className="text-gray-500">Nu există comenzi momentan.</p>
      ) : (
        <div className="space-y-3">
          {safeOrders.map((order) => (
            <div
              key={order._id}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-bold text-primary">
                      {shortOrderId(order._id)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <p className="font-bold text-gray-900">
                    {order.customerName || "Client"}
                  </p>

                  <p className="text-sm text-gray-500">
                    {formatDateTime(order.createdAt)}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="font-bold text-gray-900">
                    {formatMoney(order.totalPrice)}
                  </p>

                  <p className="text-sm text-gray-500">
                    {order.productsCount} produse
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AiReportCard({ report, loading, error, onGenerate }) {
  return (
    <div className="relative overflow-hidden bg-gray-950 text-white rounded-[2.5rem] p-6 md:p-8 border border-gray-900 shadow-sm">
      <div className="absolute -right-24 -top-24 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
      <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-orange-400/20 rounded-full blur-3xl" />

      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-7">
          <div>
            <p className="text-primary uppercase text-sm font-bold mb-2">
              Raport inteligent
            </p>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Raport inteligent pentru administrare
            </h2>

            <p className="text-white/65 leading-7 mt-3 max-w-2xl">
              Sistemul inteligent analizează comenzile, produsele vândute, statusurile și
              încasările pentru concluzii utile în administrarea restaurantului.
            </p>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="!w-auto bg-primary text-white rounded-full px-7 py-3 font-bold border-0 disabled:opacity-60 shrink-0"
          >
            {loading ? "Se generează..." : "Generează raport inteligent"}
          </button>
        </div>

        {error && (
          <div className="rounded-3xl bg-red-500/10 border border-red-400/30 text-red-100 px-5 py-4 mb-5">
            {error}
          </div>
        )}

        {!report && !loading && !error && (
          <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-5 text-white/70">
            Apasă pe buton pentru generarea raportului inteligent pe baza comenzilor
            existente.
          </div>
        )}

        {loading && (
          <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-5 text-white/70">
            Se analizează comenzile și se construiește raportul...
          </div>
        )}

        {report && !loading && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="rounded-full bg-primary text-white px-4 py-2 text-sm font-bold">
                  {report.source || "Raport inteligent"}
                </span>

                <span className="rounded-full bg-white/10 border border-white/10 text-white px-4 py-2 text-sm font-bold">
                  {report.aiUsed ? "Mod inteligent activ" : "Reguli interne"}
                </span>
              </div>

              <h3 className="font-bold text-xl mb-3">Rezumat</h3>
              <p className="text-white/75 leading-8">{report.summary}</p>
            </div>

            <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
              <h3 className="font-bold text-xl mb-4">Produse de promovat</h3>

              {Array.isArray(report.productsToPromote) &&
              report.productsToPromote.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {report.productsToPromote.map((product) => (
                    <span
                      key={product}
                      className="rounded-full bg-white text-gray-950 px-4 py-2 text-sm font-bold"
                    >
                      {product}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-white/65">
                  Nu există suficiente date pentru produse recomandate.
                </p>
              )}
            </div>

            <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
              <h3 className="font-bold text-xl mb-4">Observații</h3>

              <ul className="space-y-3">
                {(report.observations || []).map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span className="text-white/75 leading-7">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
              <h3 className="font-bold text-xl mb-4">Recomandări</h3>

              <ul className="space-y-3">
                {(report.recommendations || []).map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3">
                    <span className="text-primary font-bold">•</span>
                    <span className="text-white/75 leading-7">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-white/10 border border-white/10 p-5">
              <h3 className="font-bold text-xl mb-4">Riscuri operaționale</h3>

              <div className="grid md:grid-cols-2 gap-3">
                {(report.risks || []).map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl bg-black/20 border border-white/10 p-4 text-white/75 leading-7"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function loadDashboard() {
    try {
      setDashboardLoading(true);
      setDashboardError("");

      const res = await fetch("/api/admin/dashboard", {
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        setDashboardError(data.error || "Nu am putut încărca dashboard-ul.");
        setDashboardData(null);
        return;
      }

      setDashboardData(data);
    } catch (error) {
      console.error(error);
      setDashboardError(error.message || "A apărut o eroare la încărcarea dashboard-ului.");
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function generateAiReport() {
    try {
      setAiLoading(true);
      setAiError("");

      const res = await fetch("/api/admin/ai-report", {
        method: "POST",
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok) {
        setAiError(data.error || "Nu am putut genera raportul inteligent.");
        setAiReport(null);
        return;
      }

      setAiReport(data.report);
    } catch (error) {
      console.error(error);
      setAiError(error.message || "A apărut o eroare la generarea raportului inteligent.");
      setAiReport(null);
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = dashboardData?.stats;
  const totals = stats?.totals;

  const statusItems = useMemo(() => {
    if (!stats?.statusCounts) {
      return [];
    }

    return Object.entries(stats.statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
  }, [stats]);

  if (dashboardLoading) {
    return (
      <section className="mt-8">
        <div className="text-center mb-8">
          <UserTabs isAdmin={true} />
        </div>

        <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 font-semibold">
            Se încarcă dashboard-ul admin...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-8 pb-16">
      <div className="absolute -left-24 top-32 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-24 top-96 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center mb-8">
        <UserTabs isAdmin={true} />
      </div>

      <div className="relative text-center mb-10">
        <SectionHeaders
          subHeader="analiză administrare"
          mainHeader="Dashboard admin"
        />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Monitorizare comenzi, încasări, produse vândute și raport inteligent pentru
          decizii comerciale mai bune.
        </p>
      </div>

      {dashboardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center font-semibold">
          {dashboardError}
        </div>
      )}

      {!dashboardError && dashboardData && totals && (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Total comenzi"
              value={totals.totalOrders}
              subtitle={`${totals.activeOrders} comenzi active`}
              icon="🧾"
              dark
            />

            <StatCard
              title="Încasări totale"
              value={formatMoney(totals.totalRevenue)}
              subtitle={`Astăzi: ${formatMoney(totals.todayRevenue)}`}
              icon="💰"
            />

            <StatCard
              title="Valoare medie"
              value={formatMoney(totals.averageOrderValue)}
              subtitle="medie pe comandă"
              icon="📊"
            />

            <StatCard
              title="Produse vândute"
              value={totals.totalProductsSold}
              subtitle={`${totals.uniqueCustomers} clienți`}
              icon="🍕"
            />
          </div>

          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
            <BarChart
              title="Comenzi în ultimele 7 zile"
              items={stats.last7Days}
              valueKey="orders"
              labelKey="label"
            />

            <BarChart
              title="Încasări în ultimele 7 zile"
              items={stats.last7Days}
              valueKey="revenue"
              labelKey="label"
              formatter={formatMoney}
            />
          </div>

          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6">
            <BarChart
              title="Status comenzi"
              items={statusItems}
              valueKey="count"
              labelKey="status"
            />

            <TopProducts products={stats.topProducts || []} />
          </div>

          <AiReportCard
            report={aiReport}
            loading={aiLoading}
            error={aiError}
            onGenerate={generateAiReport}
          />

          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
            <BarChart
              title="Categorii vândute"
              items={stats.categoryBreakdown || []}
              valueKey="quantity"
              labelKey="name"
            />

            <RecentOrders orders={dashboardData.recentOrders || []} />
          </div>
        </div>
      )}
    </section>
  );
}