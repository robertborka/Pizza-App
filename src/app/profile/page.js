"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";

function buildFullAddress(profileData) {
  const streetLine = [profileData.street, profileData.streetNumber]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");

  const extraParts = [];

  if (profileData.building?.trim()) {
    extraParts.push(`Bloc ${profileData.building.trim()}`);
  }

  if (profileData.entrance?.trim()) {
    extraParts.push(`Scara ${profileData.entrance.trim()}`);
  }

  if (profileData.floor?.trim()) {
    extraParts.push(`Etaj ${profileData.floor.trim()}`);
  }

  if (profileData.apartment?.trim()) {
    extraParts.push(`Ap. ${profileData.apartment.trim()}`);
  }

  return [streetLine, ...extraParts].filter(Boolean).join(", ");
}

export default function ProfilePage() {
  const { status, update } = useSession();
  const router = useRouter();

  const [profileFetched, setProfileFetched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    image: "",
    admin: false,

    phone: "",
    city: "Brașov",
    street: "",
    streetNumber: "",
    building: "",
    entrance: "",
    floor: "",
    apartment: "",
    defaultNotes: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const fullAddress = useMemo(() => {
    return buildFullAddress(profileData);
  }, [profileData]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let ignore = false;

    async function loadProfile() {
      try {
        setProfileFetched(false);
        setMessage("");
        setMessageType("");

        const res = await fetch("/api/profile", {
          cache: "no-store",
        });

        const data = await res.json();

        if (ignore) {
          return;
        }

        if (!res.ok) {
          setMessage(data.error || "Nu am putut încărca profilul.");
          setMessageType("error");
          return;
        }

        setProfileData({
          name: data.name || "",
          email: data.email || "",
          image: data.image || "",
          admin: Boolean(data.admin),

          phone: data.phone || "",
          city: data.city || "Brașov",
          street: data.street || "",
          streetNumber: data.streetNumber || "",
          building: data.building || "",
          entrance: data.entrance || "",
          floor: data.floor || "",
          apartment: data.apartment || "",
          defaultNotes: data.defaultNotes || "",
        });
      } catch (error) {
        console.error(error);

        if (!ignore) {
          setMessage("A apărut o eroare la încărcarea profilului.");
          setMessageType("error");
        }
      } finally {
        if (!ignore) {
          setProfileFetched(true);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [status]);

  function handleInputChange(ev) {
    const { name, value } = ev.target;

    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function syncSession(userData) {
    if (typeof update !== "function" || !userData) {
      return;
    }

    await update({
      name: userData.name || "",
      image: userData.image || "",
      admin: Boolean(userData.admin),
    });
  }

  async function handleImageChange(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = "";

    if (!file || uploadingImage) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Poza trebuie să fie JPG, PNG sau WEBP.");
      setMessageType("error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Poza este prea mare. Limita este 5 MB.");
      setMessageType("error");
      return;
    }

    try {
      setUploadingImage(true);
      setMessage("");
      setMessageType("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut încărca poza de profil.");
        setMessageType("error");
        return;
      }

      const nextUserData = {
        ...profileData,
        image: data.image || "",
      };

      setProfileData(nextUserData);
      await syncSession(nextUserData);
      setMessage(data.message || "Poza de profil a fost actualizată.");
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea pozei de profil.");
      setMessageType("error");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const res = await fetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify(profileData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut salva profilul.");
        setMessageType("error");
        return;
      }

      if (data.user) {
        setProfileData((prev) => ({
          ...prev,
          ...data.user,
        }));
        await syncSession(data.user);
      }

      setMessage(data.message || "Profilul a fost actualizat cu succes.");
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la salvarea profilului.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || !profileFetched) {
    return (
      <section className="mt-8">
        <div className="text-center mb-8">
          <UserTabs isAdmin={false} />
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-4xl mx-auto">
          <p className="text-center text-gray-500 font-semibold">
            Se încarcă profilul...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="text-center mb-8">
        <UserTabs isAdmin={profileData.admin} />
      </div>

      <div className="text-center mb-10">
        <SectionHeaders subHeader="Cont client" mainHeader="Profilul meu" />

        <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
          Completează datele de contact și adresa implicită. Aceste informații
          vor putea fi preluate automat la plasarea unei comenzi.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 max-w-5xl mx-auto"
      >
        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          <div className="flex flex-col items-center">
            <div className="relative w-36 h-36 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
              <Image
                src={profileData.image || "/avatar-placeholder.png"}
                alt={profileData.name || "Utilizator"}
                width={144}
                height={144}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-5 text-center">
              <p className="font-bold text-gray-900">
                {profileData.name || "Utilizator"}
              </p>

              <p className="text-gray-500 text-sm mt-1 break-all">
                {profileData.email}
              </p>

              <span className="inline-flex mt-4 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
                {profileData.admin ? "Administrator" : "Utilizator"}
              </span>

              <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-primary bg-white px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-orange-50">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                  className="hidden"
                />
                {uploadingImage ? "Se încarcă..." : "Schimbă poza"}
              </label>

              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG sau WEBP, maximum 5 MB.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Date personale
              </h2>

              <p className="text-gray-500">
                Informațiile de aici sunt folosite pentru identificarea comenzii
                și pentru completarea rapidă a checkout-ului.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Nume și prenume
                </span>

                <input
                  type="text"
                  name="name"
                  value={profileData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Robert Borka"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Email
                </span>

                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="opacity-70 cursor-not-allowed"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Telefon
                </span>

                <input
                  type="tel"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleInputChange}
                  placeholder="Ex: 0757255753"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Oraș
                </span>

                <input
                  type="text"
                  name="city"
                  value={profileData.city}
                  onChange={handleInputChange}
                  placeholder="Ex: Brașov"
                />
              </label>
            </div>

            <div className="mt-10 mb-5">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Adresă implicită de livrare
              </h2>

              <p className="text-gray-500">
                Completează adresa o singură dată, apoi va putea fi folosită
                automat în coș.
              </p>
            </div>

            <div className="grid md:grid-cols-[1fr_140px] gap-4">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Stradă
                </span>

                <input
                  type="text"
                  name="street"
                  value={profileData.street}
                  onChange={handleInputChange}
                  placeholder="Ex: Strada Rozelor"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Număr
                </span>

                <input
                  type="text"
                  name="streetNumber"
                  value={profileData.streetNumber}
                  onChange={handleInputChange}
                  placeholder="Ex: 36B"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Bloc
                </span>

                <input
                  type="text"
                  name="building"
                  value={profileData.building}
                  onChange={handleInputChange}
                  placeholder="Ex: A"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Scară
                </span>

                <input
                  type="text"
                  name="entrance"
                  value={profileData.entrance}
                  onChange={handleInputChange}
                  placeholder="Ex: 2"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Etaj
                </span>

                <input
                  type="text"
                  name="floor"
                  value={profileData.floor}
                  onChange={handleInputChange}
                  placeholder="Ex: 3"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-sm text-gray-700">
                  Apartament
                </span>

                <input
                  type="text"
                  name="apartment"
                  value={profileData.apartment}
                  onChange={handleInputChange}
                  placeholder="Ex: 14"
                />
              </label>
            </div>

            <div className="mt-5 rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <p className="font-bold text-gray-900 mb-2">
                Adresă completă generată
              </p>

              <p className="text-gray-600">
                {fullAddress ||
                  "Completează strada și numărul pentru generarea adresei."}
              </p>
            </div>

            <label className="flex flex-col gap-2 mt-5">
              <span className="font-semibold text-sm text-gray-700">
                Observații implicite pentru comandă
              </span>

              <textarea
                name="defaultNotes"
                value={profileData.defaultNotes}
                onChange={handleInputChange}
                placeholder="Ex: Sunați când ajunge curierul. Nu merge interfonul."
                rows={4}
                className="block w-full rounded-xl border p-3 border-gray-300 bg-gray-100"
              />
            </label>

            {message && (
              <div
                className={
                  messageType === "success"
                    ? "mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700 font-semibold"
                    : "mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 font-semibold"
                }
              >
                {message}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={saving}
                className="!w-auto bg-primary text-white rounded-full px-8 py-3 font-bold border-0 disabled:opacity-60"
              >
                {saving ? "Se salvează..." : "Salvează profilul"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/cart")}
                className="!w-auto border border-gray-300 text-gray-700 rounded-full px-8 py-3 font-bold bg-white"
              >
                Mergi la coș
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}