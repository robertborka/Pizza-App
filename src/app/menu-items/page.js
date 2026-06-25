"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";
import { formatMoney } from "@/libs/formatters";

const emptyForm = {
  name: "",
  description: "",
  basePrice: "",
  image: "",
  category: "",
  available: true,
  ingredients: [],
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

function getCategoryName(category) {
  if (!category) {
    return "-";
  }

  if (typeof category === "string") {
    return category;
  }

  return category.name || "-";
}

function getIngredientNames(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return "Fără ingrediente";
  }

  return ingredients
    .map((ingredient) => {
      if (typeof ingredient === "string") {
        return ingredient;
      }

      return ingredient.name;
    })
    .filter(Boolean)
    .join(", ");
}

export default function MenuItemsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [admin, setAdmin] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  const [formData, setFormData] = useState(emptyForm);
  const [editedItem, setEditedItem] = useState(null);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [ingredientSearch, setIngredientSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadProfileAndData() {
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

        await loadData();
      } catch (error) {
        console.error(error);
        setMessage("A apărut o eroare la verificarea profilului.");
        setMessageType("error");
      } finally {
        setProfileFetched(true);
      }
    }

    loadProfileAndData();
  }, [status, router]);

  const filteredIngredients = useMemo(() => {
    const search = ingredientSearch.trim().toLowerCase();

    if (!search) {
      return ingredients;
    }

    return ingredients.filter((ingredient) =>
      ingredient.name?.toLowerCase().includes(search)
    );
  }, [ingredients, ingredientSearch]);

  const filteredMenuItems = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search);

      const itemCategoryId =
        typeof item.category === "object" && item.category?._id
          ? item.category._id
          : item.category;

      const matchesCategory =
        categoryFilter === "all" || itemCategoryId === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, productSearch, categoryFilter]);

  async function loadData() {
    try {
      setLoadingData(true);
      setMessage("");
      setMessageType("");

      const [menuItemsRes, categoriesRes, ingredientsRes] = await Promise.all([
        fetch("/api/menu-items", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/ingredients", { cache: "no-store" }),
      ]);

      const menuItemsData = await menuItemsRes.json();
      const categoriesData = await categoriesRes.json();
      const ingredientsData = await ingredientsRes.json();

      if (!menuItemsRes.ok) {
        setMessage(menuItemsData.error || "Nu am putut încărca produsele.");
        setMessageType("error");
        setMenuItems([]);
        return;
      }

      if (!categoriesRes.ok) {
        setMessage(categoriesData.error || "Nu am putut încărca categoriile.");
        setMessageType("error");
        setCategories([]);
        return;
      }

      if (!ingredientsRes.ok) {
        setMessage(
          ingredientsData.error || "Nu am putut încărca ingredientele."
        );
        setMessageType("error");
        setIngredients([]);
        return;
      }

      setMenuItems(getArrayFromResponse(menuItemsData, "menuItems"));
      setCategories(getArrayFromResponse(categoriesData, "categories"));
      setIngredients(getArrayFromResponse(ingredientsData, "ingredients"));
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea datelor.");
      setMessageType("error");
      setMenuItems([]);
      setCategories([]);
      setIngredients([]);
    } finally {
      setLoadingData(false);
    }
  }

  function resetForm() {
    setFormData(emptyForm);
    setEditedItem(null);
    setIngredientSearch("");
  }

  function handleInputChange(ev) {
    const { name, value } = ev.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleIngredientToggle(ingredientId) {
    setFormData((prev) => {
      const alreadySelected = prev.ingredients.includes(ingredientId);

      return {
        ...prev,
        ingredients: alreadySelected
          ? prev.ingredients.filter((id) => id !== ingredientId)
          : [...prev.ingredients, ingredientId],
      };
    });
  }

  function startEdit(item) {
    const categoryId =
      typeof item.category === "object" && item.category?._id
        ? item.category._id
        : item.category || "";

    const ingredientIds = Array.isArray(item.ingredients)
      ? item.ingredients
          .map((ingredient) => {
            if (typeof ingredient === "object" && ingredient?._id) {
              return ingredient._id;
            }

            return ingredient;
          })
          .filter(Boolean)
      : [];

    setEditedItem(item);

    setFormData({
      name: item.name || "",
      description: item.description || "",
      basePrice: String(item.basePrice || ""),
      image: item.image || "",
      category: categoryId,
      available: item.available !== false,
      ingredients: ingredientIds,
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
    const description = formData.description.trim();
    const image = formData.image.trim();
    const basePrice = Number(formData.basePrice);
    const category = formData.category;
    const available = Boolean(formData.available);

    if (!name) {
      setMessage("Numele produsului este obligatoriu.");
      setMessageType("error");
      return;
    }

    if (!basePrice || basePrice <= 0) {
      setMessage("Prețul trebuie să fie mai mare decât 0.");
      setMessageType("error");
      return;
    }

    if (!category) {
      setMessage("Categoria produsului este obligatorie.");
      setMessageType("error");
      return;
    }

    if (image && !(image.startsWith("/") || image.startsWith("http://") || image.startsWith("https://"))) {
      setMessage("Imaginea trebuie să fie un URL valid sau o cale internă care începe cu /. ");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const url = editedItem
        ? `/api/menu-items/${editedItem._id}`
        : "/api/menu-items";

      const method = editedItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: JSON.stringify({
          name,
          description,
          basePrice,
          image,
          category,
          available,
          ingredients: formData.ingredients,
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
        editedItem ? "Produsul a fost actualizat." : "Produsul a fost creat."
      );
      setMessageType("success");

      resetForm();
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la salvarea produsului.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    const confirmed = window.confirm("Sigur vrei să ștergi acest produs?");

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(itemId);
      setMessage("");
      setMessageType("");

      const res = await fetch(`/api/menu-items/${itemId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut șterge produsul.");
        setMessageType("error");
        return;
      }

      setMessage("Produsul a fost șters.");
      setMessageType("success");

      if (editedItem?._id === itemId) {
        resetForm();
      }

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la ștergerea produsului.");
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
        <SectionHeaders subHeader="administrare" mainHeader="Produse" />

        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Aici poți administra produsele din meniu: pizza, băuturi, deserturi și
          sosuri.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 mb-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-wide text-primary font-bold mb-1">
              {editedItem ? "Modificare produs" : "Produs nou"}
            </p>

            <h2 className="text-2xl font-bold text-gray-900">
              {editedItem ? "Editează produsul" : "Adaugă produs nou"}
            </h2>

            <p className="text-gray-500 mt-2">
              Completează datele produsului și selectează ingredientele vizual,
              într-o interfață clară și ușor de administrat.
            </p>
          </div>

          {editedItem && (
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
          <div className="grid lg:grid-cols-[1fr_260px] gap-8">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="font-semibold text-gray-700">
                  Nume produs
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ex: Pizza Margherita"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={saving}
                  required
                  maxLength={120}
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700">
                  Preț
                </label>
                <input
                  type="number"
                  name="basePrice"
                  placeholder="Ex: 32"
                  value={formData.basePrice}
                  onChange={handleInputChange}
                  disabled={saving}
                  min="1"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700">
                  Imagine
                </label>
                <input
                  type="text"
                  name="image"
                  placeholder="/menu/pizza-margherita.png"
                  value={formData.image}
                  onChange={handleInputChange}
                  disabled={saving}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Cale internă care începe cu / sau link http/https.
                </p>
              </div>

              <div>
                <label className="font-semibold text-gray-700">
                  Categorie
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  disabled={saving}
                  className="block w-full my-2 rounded-xl border p-2 border-gray-300 bg-gray-100"
                >
                  <option value="">Alege categoria</option>

                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="md:col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
                <span>
                  <span className="block font-bold text-gray-900">Produs disponibil</span>
                  <span className="block text-sm text-gray-500">Dacă este dezactivat, produsul nu apare în meniul public.</span>
                </span>
                <input
                  type="checkbox"
                  name="available"
                  checked={Boolean(formData.available)}
                  onChange={(ev) =>
                    setFormData((prev) => ({
                      ...prev,
                      available: ev.target.checked,
                    }))
                  }
                  disabled={saving}
                  className="h-5 w-5"
                />
              </label>

              <div className="md:col-span-2">
                <label className="font-semibold text-gray-700">
                  Descriere
                </label>
                <textarea
                  name="description"
                  placeholder="Descriere produs"
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={saving}
                  rows={4}
                  className="block w-full my-2 rounded-xl border p-2 border-gray-300 bg-gray-100"
                  maxLength={600}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100">
              <p className="font-bold text-gray-900 mb-3">
                Previzualizare
              </p>

              <div className="bg-white rounded-2xl h-44 flex items-center justify-center overflow-hidden mb-4 border border-gray-100">
                <img
                  src={formData.image || "/pizza.png"}
                  alt={formData.name || "Produs"}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <h3 className="font-bold text-gray-900">
                {formData.name || "Nume produs"}
              </h3>

              <p className="text-sm text-gray-500 line-clamp-3 mt-1">
                {formData.description || "Descriere produs"}
              </p>

              <div className="flex items-center justify-between gap-3 mt-3">
                <p className="text-primary font-bold">
                  {formatMoney(formData.basePrice || 0)}
                </p>
                <span className={formData.available ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700" : "rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500"}>
                  {formData.available ? "Disponibil" : "Indisponibil"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Ingrediente produs
                </h3>

                <p className="text-gray-500 text-sm mt-1">
                  Selectate: {formData.ingredients.length}
                </p>
              </div>

              <input
                type="text"
                placeholder="Caută ingredient..."
                value={ingredientSearch}
                onChange={(ev) => setIngredientSearch(ev.target.value)}
                className="md:max-w-xs"
              />
            </div>

            {ingredients.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Nu există ingrediente disponibile.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredIngredients.map((ingredient) => {
                  const selected = formData.ingredients.includes(
                    ingredient._id
                  );

                  return (
                    <button
                      key={ingredient._id}
                      type="button"
                      onClick={() => handleIngredientToggle(ingredient._id)}
                      disabled={saving}
                      className={
                        selected
                          ? "!w-full border-2 border-primary bg-primary/10 rounded-2xl p-3 text-left"
                          : "!w-full border border-gray-200 bg-gray-50 hover:bg-white hover:border-primary/40 rounded-2xl p-3 text-left transition"
                      }
                    >
                      <div className="h-20 bg-white rounded-xl flex items-center justify-center overflow-hidden mb-3 border border-gray-100">
                        <img
                          src={ingredient.image || "/pizza.png"}
                          alt={ingredient.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>

                      <div className="flex items-start gap-2">
                        <span
                          className={
                            selected
                              ? "mt-1 w-4 h-4 rounded-full bg-primary border border-primary flex-shrink-0"
                              : "mt-1 w-4 h-4 rounded-full bg-white border border-gray-300 flex-shrink-0"
                          }
                        />

                        <span className="font-bold text-sm text-gray-800 leading-5">
                          {ingredient.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <button
              type="submit"
              disabled={saving}
              className="!w-auto bg-primary text-white border-0 rounded-full px-8 py-3 font-bold disabled:opacity-60"
            >
              {saving
                ? "Se salvează..."
                : editedItem
                ? "Salvează modificările"
                : "Adaugă produs"}
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Produse salvate
            </h2>

            <p className="text-gray-500 mt-1">
              Total produse afișate: {filteredMenuItems.length}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Caută produs..."
              value={productSearch}
              onChange={(ev) => setProductSearch(ev.target.value)}
              className="sm:w-64"
            />

            <select
              value={categoryFilter}
              onChange={(ev) => setCategoryFilter(ev.target.value)}
              className="block rounded-xl border p-2 border-gray-300 bg-gray-100"
            >
              <option value="all">Toate categoriile</option>

              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingData ? (
          <p className="text-gray-500 text-center py-8">
            Se încarcă produsele...
          </p>
        ) : filteredMenuItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nu există produse pentru filtrarea curentă.
          </p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            {filteredMenuItems.map((item) => (
              <div
                key={item._id}
                className="border border-gray-200 rounded-3xl p-4 flex gap-4 bg-gray-50 hover:bg-white transition"
              >
                <div className="w-28 h-28 bg-white rounded-2xl overflow-hidden flex items-center justify-center border border-gray-100 flex-shrink-0">
                  <img
                    src={item.image || "/pizza.png"}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">
                        {item.name}
                      </h3>

                      <p className="text-gray-500 text-sm line-clamp-2">
                        {item.description || "Fără descriere"}
                      </p>
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <p className="font-bold text-primary whitespace-nowrap">
                        {formatMoney(item.basePrice)}
                      </p>
                      <span className={item.available !== false ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700" : "rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500"}>
                        {item.available !== false ? "Disponibil" : "Indisponibil"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <p>
                      <span className="font-semibold">Categorie:</span>{" "}
                      {getCategoryName(item.category)}
                    </p>

                    <p className="line-clamp-2">
                      <span className="font-semibold">Ingrediente:</span>{" "}
                      {getIngredientNames(item.ingredients)}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={saving || deletingId === item._id}
                      className="!w-auto border border-gray-300 rounded-full px-5 py-2 text-gray-700 font-semibold bg-white"
                    >
                      Editează
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      disabled={saving || deletingId === item._id}
                      className="!w-auto bg-red-500 text-white border-0 rounded-full px-5 py-2 font-semibold disabled:opacity-60"
                    >
                      {deletingId === item._id ? "Se șterge..." : "Șterge"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}