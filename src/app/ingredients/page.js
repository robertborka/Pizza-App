"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";

const emptyForm = {
  name: "",
  slug: "",
  image: "",
  aliasesText: "",
};

function getArrayFromResponse(data, key) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[key])) {
    return data[key];
  }

  return [];
}

function createSlug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ş/g, "s")
    .replace(/ț/g, "t")
    .replace(/ţ/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseAliases(text) {
  return String(text || "")
    .split(/[,\n]/)
    .map((alias) => alias.trim())
    .filter(Boolean);
}

export default function IngredientsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [ingredients, setIngredients] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [editedIngredient, setEditedIngredient] = useState(null);

  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadProfileAndIngredients() {
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

        await loadIngredients();
      } catch (error) {
        console.error(error);
        setMessage("A apărut o eroare la verificarea profilului.");
        setMessageType("error");
      } finally {
        setProfileFetched(true);
      }
    }

    loadProfileAndIngredients();
  }, [status, router]);

  const filteredIngredients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return ingredients;
    }

    return ingredients.filter((ingredient) => {
      const aliases = Array.isArray(ingredient.aliases)
        ? ingredient.aliases.join(" ").toLowerCase()
        : "";

      return (
        ingredient.name?.toLowerCase().includes(query) ||
        ingredient.slug?.toLowerCase().includes(query) ||
        aliases.includes(query)
      );
    });
  }, [ingredients, search]);

  async function loadIngredients() {
    try {
      setLoadingIngredients(true);
      setMessage("");
      setMessageType("");

      const res = await fetch("/api/ingredients", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut încărca ingredientele.");
        setMessageType("error");
        setIngredients([]);
        return;
      }

      setIngredients(getArrayFromResponse(data, "ingredients"));
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea ingredientelor.");
      setMessageType("error");
      setIngredients([]);
    } finally {
      setLoadingIngredients(false);
    }
  }

  function resetForm() {
    setFormData(emptyForm);
    setEditedIngredient(null);
  }

  function handleInputChange(ev) {
    const { name, value } = ev.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleNameChange(ev) {
    const value = ev.target.value;

    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: editedIngredient ? prev.slug : createSlug(value),
    }));
  }

  function startEdit(ingredient) {
    setEditedIngredient(ingredient);

    setFormData({
      name: ingredient.name || "",
      slug: ingredient.slug || "",
      image: ingredient.image || "",
      aliasesText: Array.isArray(ingredient.aliases)
        ? ingredient.aliases.join(", ")
        : "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(ev) {
    ev.preventDefault();

    const name = formData.name.trim();
    const slug = formData.slug.trim() || createSlug(name);
    const image = formData.image.trim();
    const aliases = parseAliases(formData.aliasesText);

    if (!name) {
      setMessage("Numele ingredientului este obligatoriu.");
      setMessageType("error");
      return;
    }

    if (!slug) {
      setMessage("Slug-ul ingredientului este obligatoriu.");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const url = editedIngredient
        ? `/api/ingredients/${editedIngredient._id}`
        : "/api/ingredients";

      const method = editedIngredient ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: JSON.stringify({
          name,
          slug,
          image,
          aliases,
        }),
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
        editedIngredient
          ? "Ingredientul a fost actualizat."
          : "Ingredientul a fost creat."
      );
      setMessageType("success");

      resetForm();
      await loadIngredients();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la salvarea ingredientului.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ingredientId) {
    const confirmed = window.confirm(
      "Sigur vrei să ștergi acest ingredient?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(ingredientId);
      setMessage("");
      setMessageType("");

      const res = await fetch(`/api/ingredients/${ingredientId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut șterge ingredientul.");
        setMessageType("error");
        return;
      }

      setMessage("Ingredientul a fost șters.");
      setMessageType("success");

      if (editedIngredient?._id === ingredientId) {
        resetForm();
      }

      await loadIngredients();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la ștergerea ingredientului.");
      setMessageType("error");
    } finally {
      setDeletingId("");
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

      <div className="text-center mb-8">
        <SectionHeaders subHeader="administrare" mainHeader="Ingrediente" />

        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Aici poți administra ingredientele folosite la produse și la
          recomandările inteligente.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 mb-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary font-bold mb-1">
              {editedIngredient ? "Modificare ingredient" : "Ingredient nou"}
            </p>

            <h2 className="text-2xl font-bold text-gray-900">
              {editedIngredient
                ? "Editează ingredientul"
                : "Adaugă ingredient nou"}
            </h2>

            <p className="text-gray-500 mt-2">
              Ingredientele sunt folosite atât pentru produse, cât și pentru
              recomandarea inteligentă.
            </p>
          </div>

          {editedIngredient && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="!w-auto border border-gray-300 text-gray-700 rounded-full px-7 py-3 font-bold hover:bg-gray-50"
            >
              Anulează editarea
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-[1fr_240px] gap-8">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="font-semibold text-gray-700">
                  Nume ingredient
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ex: Mozzarella"
                  value={formData.name}
                  onChange={handleNameChange}
                  disabled={saving}
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700">Slug</label>
                <input
                  type="text"
                  name="slug"
                  placeholder="mozzarella"
                  value={formData.slug}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-semibold text-gray-700">Imagine</label>
                <input
                  type="text"
                  name="image"
                  placeholder="/ingredients/mozzarella.png"
                  value={formData.image}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-semibold text-gray-700">
                  Alias-uri
                </label>
                <textarea
                  name="aliasesText"
                  placeholder="Ex: mozzarella, cașcaval, brânză"
                  value={formData.aliasesText}
                  onChange={handleInputChange}
                  disabled={saving}
                  rows={4}
                  className="block w-full my-2 rounded-xl border p-2 border-gray-300 bg-gray-100"
                />

                <p className="text-xs text-gray-500">
                  Alias-urile se pot separa prin virgulă sau pe linii diferite.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100">
              <p className="font-bold text-gray-900 mb-3">
                Previzualizare
              </p>

              <div className="bg-white rounded-2xl h-40 flex items-center justify-center overflow-hidden mb-4 border border-gray-100">
                <img
                  src={formData.image || "/pizza.png"}
                  alt={formData.name || "Ingredient"}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <h3 className="font-bold text-gray-900">
                {formData.name || "Nume ingredient"}
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                {formData.slug || "slug-ingredient"}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button
              type="submit"
              disabled={saving}
              className="!w-auto bg-primary text-white border-0 rounded-full px-8 py-3 font-bold disabled:opacity-60"
            >
              {saving
                ? "Se salvează..."
                : editedIngredient
                ? "Salvează modificările"
                : "Adaugă ingredient"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="!w-auto border border-gray-300 text-gray-700 rounded-full px-8 py-3 font-bold"
            >
              Curăță formularul
            </button>
          </div>
        </form>

        {message && (
          <div
            className={
              messageType === "success"
                ? "mt-6 rounded-xl bg-green-100 text-green-700 border border-green-200 px-4 py-3 text-sm font-semibold"
                : "mt-6 rounded-xl bg-red-100 text-red-700 border border-red-200 px-4 py-3 text-sm font-semibold"
            }
          >
            {message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Ingrediente salvate
            </h2>

            <p className="text-gray-500 mt-1">
              Total ingrediente afișate: {filteredIngredients.length}
            </p>
          </div>

          <input
            type="text"
            placeholder="Caută ingredient..."
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            className="sm:w-72"
          />
        </div>

        {loadingIngredients ? (
          <p className="text-gray-500 text-center py-8">
            Se încarcă ingredientele...
          </p>
        ) : filteredIngredients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nu există ingrediente pentru filtrarea curentă.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIngredients.map((ingredient) => (
              <div
                key={ingredient._id}
                className="border border-gray-200 rounded-3xl p-4 bg-gray-50 hover:bg-white transition"
              >
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-white rounded-2xl overflow-hidden flex items-center justify-center border border-gray-100 flex-shrink-0">
                    <img
                      src={ingredient.image || "/pizza.png"}
                      alt={ingredient.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {ingredient.name}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Slug: {ingredient.slug || "-"}
                    </p>

                    <p className="text-sm text-gray-500 line-clamp-2">
                      Alias-uri:{" "}
                      {Array.isArray(ingredient.aliases) &&
                      ingredient.aliases.length > 0
                        ? ingredient.aliases.join(", ")
                        : "Fără alias-uri"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => startEdit(ingredient)}
                    disabled={saving || deletingId === ingredient._id}
                    className="!w-auto border border-gray-300 rounded-full px-5 py-2 text-gray-700 font-semibold bg-white"
                  >
                    Editează
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(ingredient._id)}
                    disabled={saving || deletingId === ingredient._id}
                    className="!w-auto bg-red-500 text-white border-0 rounded-full px-5 py-2 font-semibold disabled:opacity-60"
                  >
                    {deletingId === ingredient._id
                      ? "Se șterge..."
                      : "Șterge"}
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