"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";

export default function CategoriesPage() {
  const { status } = useSession();
  const router = useRouter();

  const [categories, setCategories] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [editedCategory, setEditedCategory] = useState(null);

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadProfileAndCategories() {
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

        await loadCategories();
      } catch (error) {
        console.error(error);
        setMessage("A apărut o eroare la verificarea profilului.");
        setMessageType("error");
      } finally {
        setProfileFetched(true);
      }
    }

    loadProfileAndCategories();
  }, [status, router]);

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      setMessage("");
      setMessageType("");

      const res = await fetch("/api/categories", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut încărca categoriile.");
        setMessageType("error");
        setCategories([]);
        return;
      }

      const loadedCategories = Array.isArray(data)
        ? data
        : Array.isArray(data.categories)
        ? data.categories
        : [];

      setCategories(loadedCategories);
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea categoriilor.");
      setMessageType("error");
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  function resetForm() {
    setCategoryName("");
    setEditedCategory(null);
  }

  function startEdit(category) {
    setEditedCategory(category);
    setCategoryName(category.name || "");
    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(ev) {
    ev.preventDefault();

    const name = categoryName.trim();

    if (!name) {
      setMessage("Numele categoriei este obligatoriu.");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const url = editedCategory
        ? `/api/categories/${editedCategory._id}`
        : "/api/categories";

      const method = editedCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: JSON.stringify({ name }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Operația a eșuat.");
        setMessageType("error");
        return;
      }

      setMessage(
        editedCategory
          ? "Categoria a fost actualizată."
          : "Categoria a fost creată."
      );
      setMessageType("success");

      resetForm();
      await loadCategories();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la salvarea categoriei.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId) {
    const confirmed = window.confirm(
      "Sigur vrei să ștergi această categorie?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(categoryId);
      setMessage("");
      setMessageType("");

      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut șterge categoria.");
        setMessageType("error");
        return;
      }

      setMessage("Categoria a fost ștearsă.");
      setMessageType("success");

      if (editedCategory?._id === categoryId) {
        resetForm();
      }

      await loadCategories();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la ștergerea categoriei.");
      setMessageType("error");
    } finally {
      setDeletingId("");
    }
  }

  if (status === "loading" || !profileFetched) {
    return (
      <section className="mt-8 text-center">
        Se încarcă...
      </section>
    );
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

      <div className="text-center mb-8">
        <SectionHeaders
          subHeader="administrare"
          mainHeader="Categorii"
        />

        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Aici poți adăuga, edita și șterge categoriile de produse din meniu.
        </p>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="mb-8">
          <label className="font-semibold text-gray-700">
            {editedCategory ? "Editează categoria" : "Adaugă categorie nouă"}
          </label>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <input
              type="text"
              placeholder="Nume categorie"
              value={categoryName}
              onChange={(ev) => setCategoryName(ev.target.value)}
              disabled={saving}
            />

            <button
              type="submit"
              disabled={saving}
              className="!w-auto bg-primary text-white border-0 rounded-xl px-8 py-2 font-semibold disabled:opacity-60"
            >
              {saving
                ? "Se salvează..."
                : editedCategory
                ? "Salvează"
                : "Adaugă"}
            </button>

            {editedCategory && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="!w-auto border border-gray-300 rounded-xl px-8 py-2 font-semibold text-gray-700"
              >
                Anulează
              </button>
            )}
          </div>
        </form>

        {message && (
          <div
            className={
              messageType === "success"
                ? "mb-6 rounded-xl bg-green-100 text-green-700 border border-green-200 px-4 py-3 text-sm font-semibold"
                : "mb-6 rounded-xl bg-red-100 text-red-700 border border-red-200 px-4 py-3 text-sm font-semibold"
            }
          >
            {message}
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Categorii existente
        </h2>

        {loadingCategories ? (
          <p className="text-gray-500 text-center py-6">
            Se încarcă categoriile...
          </p>
        ) : categories.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            Nu există categorii momentan.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map((category) => (
              <div
                key={category._id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-xl p-4"
              >
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    {category.name}
                  </h3>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(category)}
                    disabled={saving || deletingId === category._id}
                    className="!w-auto border border-gray-300 rounded-full px-5 py-2 text-gray-700 font-semibold"
                  >
                    Editează
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(category._id)}
                    disabled={saving || deletingId === category._id}
                    className="!w-auto bg-red-500 text-white border-0 rounded-full px-5 py-2 font-semibold disabled:opacity-60"
                  >
                    {deletingId === category._id ? "Se șterge..." : "Șterge"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}