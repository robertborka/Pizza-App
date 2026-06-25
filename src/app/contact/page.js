"use client";

import { useState } from "react";
import Link from "next/link";
import SectionHeaders from "../components/layout/sectionHeaders";
import { restaurantInfo, restaurantFullAddress } from "@/libs/restaurantInfo";

const MESSAGE_MAX_LENGTH = 1500;

const initialFormData = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
};

export default function ContactPage() {
  const [formData, setFormData] = useState(initialFormData);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [formStartedAt] = useState(() => Date.now());

  const encodedAddress = encodeURIComponent(restaurantFullAddress);
  const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  function handleChange(ev) {
    const { name, value } = ev.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setStatusMessage("");
    setStatusType("");

    if (!formData.name.trim()) {
      setStatusType("error");
      setStatusMessage("Completează numele.");
      return;
    }

    if (!formData.email.trim()) {
      setStatusType("error");
      setStatusMessage("Completează adresa de email.");
      return;
    }

    if (!formData.message.trim()) {
      setStatusType("error");
      setStatusMessage("Scrie mesajul înainte să îl trimiți.");
      return;
    }

    if (formData.message.trim().length > MESSAGE_MAX_LENGTH) {
      setStatusType("error");
      setStatusMessage(`Mesajul poate avea maximum ${MESSAGE_MAX_LENGTH} de caractere.`);
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          startedAt: formStartedAt,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Mesajul nu a putut fi trimis.");
      }

      setFormData(initialFormData);
      setStatusType("success");
      setStatusMessage("Mesajul a fost trimis. Îți vom răspunde cât mai curând pe email.");
    } catch (error) {
      setStatusType("error");
      setStatusMessage(
        error.message ||
          "Mesajul nu a putut fi trimis momentan. Te rugăm să încerci din nou."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="text-center mb-10">
        <SectionHeaders subHeader="suntem aici" mainHeader="Contact" />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Ai întrebări despre meniu, comenzi, livrare sau produse? Trimite un
          mesaj folosind formularul de mai jos sau contactează-ne direct.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 mb-16">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-primary text-sm uppercase font-bold tracking-wide mb-2">
                Mesaj direct
              </p>

              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                Scrie-ne rapid
              </h2>
            </div>

            <span className="hidden sm:inline-flex rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-primary border border-primary/10">
              Răspuns pe email
            </span>
          </div>

          <p className="text-gray-500 mb-6 leading-7">
            Formularul trimite mesajul direct către restaurant. Completează
            datele de contact corect, ca să putem răspunde cât mai ușor.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Nume complet
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ex: Robert Borka"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  maxLength={120}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="exemplu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  maxLength={180}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Telefon
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="0760 530 530"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  maxLength={80}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600">
                  Subiect
                </label>
                <input
                  type="text"
                  name="subject"
                  placeholder="Comandă, livrare, meniu..."
                  value={formData.subject}
                  onChange={handleChange}
                  maxLength={120}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600">
                Mesaj
              </label>
              <textarea
                name="message"
                placeholder="Scrie mesajul tău aici..."
                value={formData.message}
                onChange={handleChange}
                rows={6}
                maxLength={MESSAGE_MAX_LENGTH}
                required
                className="block w-full my-2 rounded-xl border p-3 border-gray-300 bg-gray-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-right text-xs font-semibold text-gray-400">
                {formData.message.length}/{MESSAGE_MAX_LENGTH} caractere
              </p>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="bg-primary text-white border-0 rounded-full px-8 py-3 font-bold mt-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSending ? "Se trimite..." : "Trimite mesajul"}
            </button>

            {statusMessage && (
              <div
                className={
                  statusType === "success"
                    ? "mt-3 rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-green-800"
                    : "mt-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700"
                }
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                    {statusType === "success" ? "✓" : "!"}
                  </span>
                  <div>
                    <p className="font-bold">
                      {statusType === "success" ? "Mesaj trimis" : "Mesaj netrimis"}
                    </p>
                    <p className="text-sm leading-6">{statusMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Date de contact
            </h3>

            <div className="flex flex-col gap-4 text-gray-600 leading-7">
              <p>
                <span className="font-semibold text-gray-900">Restaurant:</span>{" "}
                {restaurantInfo.name}
              </p>

              <p>
                <span className="font-semibold text-gray-900">Adresă:</span>{" "}
                {restaurantFullAddress}
              </p>

              <p>
                <span className="font-semibold text-gray-900">Telefon:</span>{" "}
                <a
                  href={`tel:${restaurantInfo.phone.replace(/\s/g, "")}`}
                  className="text-primary font-semibold underline"
                >
                  {restaurantInfo.phone}
                </a>
              </p>

              <p>
                <span className="font-semibold text-gray-900">Email:</span>{" "}
                <a
                  href={`mailto:${restaurantInfo.email}`}
                  className="text-primary font-semibold underline"
                >
                  {restaurantInfo.email}
                </a>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Program
            </h3>

            <div className="flex flex-col gap-3 text-gray-600">
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span>Luni - Vineri</span>
                <span className="font-semibold text-gray-900">
                  {restaurantInfo.schedule.mondayFriday}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                <span>Sâmbătă</span>
                <span className="font-semibold text-gray-900">
                  {restaurantInfo.schedule.saturday}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span>Duminică</span>
                <span className="font-semibold text-gray-900">
                  {restaurantInfo.schedule.sunday}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-primary text-white rounded-[2rem] p-7 shadow-sm">
            <h3 className="text-xl font-bold mb-3">
              Vrei să comanzi rapid?
            </h3>

            <p className="leading-7 mb-5 text-white/90">
              Intră în meniu, alege produsele dorite și adaugă-le în coș.
              Comanda se poate finaliza direct din aplicație.
            </p>

            <Link
              href="/menu"
              className="inline-block bg-white text-primary rounded-full px-7 py-3 font-bold"
            >
              Vezi meniul
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 mb-16">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Unde ne găsești
          </h2>

          <p className="text-gray-600 leading-7 mb-6">
            Restaurantul se află în Brașov, iar adresa este folosită și pentru
            calcularea rutei de livrare după plasarea comenzii.
          </p>

          <div className="bg-gray-100 rounded-2xl p-5 mb-6">
            <p className="text-sm text-gray-500 mb-1">
              Adresă restaurant
            </p>

            <p className="text-lg font-bold text-gray-900">
              {restaurantFullAddress}
            </p>
          </div>

          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-white rounded-full px-8 py-3 font-bold"
          >
            Deschide ruta în Google Maps
          </a>
        </div>

        <div className="rounded-[2rem] overflow-hidden border border-gray-200 bg-white shadow-sm min-h-[380px]">
          <iframe
            src={googleMapsEmbedUrl}
            width="100%"
            height="100%"
            className="w-full h-[380px] lg:h-full border-0"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Harta Top Family Pizza"
          />
        </div>
      </div>
    </section>
  );
}
