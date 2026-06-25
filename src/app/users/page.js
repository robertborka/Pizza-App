"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserTabs from "../components/layout/userTabs";
import SectionHeaders from "../components/layout/sectionHeaders";

function getArrayFromResponse(data, key) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[key])) {
    return data[key];
  }

  return [];
}

function getUserInitials(name, email) {
  const source = name || email || "U";

  return source
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

export default function UsersPage() {
  const { status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [profileFetched, setProfileFetched] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadProfileAndUsers() {
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
        setCurrentUserId(profileData._id || profileData.id || "");

        if (!isAdmin) {
          router.push("/profile");
          return;
        }

        await loadUsers();
      } catch (error) {
        console.error(error);
        setMessage("A apărut o eroare la verificarea profilului.");
        setMessageType("error");
      } finally {
        setProfileFetched(true);
      }
    }

    loadProfileAndUsers();
  }, [status, router]);

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setMessage("");
      setMessageType("");

      const res = await fetch("/api/users", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut încărca utilizatorii.");
        setMessageType("error");
        setUsers([]);
        return;
      }

      setUsers(getArrayFromResponse(data, "users"));
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la încărcarea utilizatorilor.");
      setMessageType("error");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function updateUserAdmin(userId, adminValue) {
    const isCurrentUser = currentUserId === userId;

    if (isCurrentUser && adminValue === false) {
      setMessage("Nu îți poți scoate singur drepturile de administrator.");
      setMessageType("error");
      return;
    }

    try {
      setUpdatingId(userId);
      setMessage("");
      setMessageType("");

      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          admin: adminValue,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Nu am putut actualiza utilizatorul.");
        setMessageType("error");
        return;
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId ? { ...user, admin: adminValue } : user
        )
      );

      setMessage(
        adminValue
          ? "Utilizatorul a primit drepturi de administrator."
          : "Drepturile de administrator au fost eliminate."
      );
      setMessageType("success");
    } catch (error) {
      console.error(error);
      setMessage("A apărut o eroare la actualizarea utilizatorului.");
      setMessageType("error");
    } finally {
      setUpdatingId("");
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
          mainHeader="Utilizatori"
        />

        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
          Aici poți vedea utilizatorii înregistrați și poți gestiona drepturile
          de administrator. Modificările de rol se aplică imediat, deci verifică atent utilizatorul selectat.
        </p>
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Utilizatori existenți
            </h2>

            <p className="text-gray-500 text-sm mt-1">
              Total utilizatori: {users.length}
            </p>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loadingUsers}
            className="!w-auto border border-gray-300 rounded-full px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loadingUsers ? "Se reîncarcă..." : "Reîncarcă lista"}
          </button>
        </div>

        {loadingUsers ? (
          <p className="text-gray-500 text-center py-8">
            Se încarcă utilizatorii...
          </p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nu există utilizatori momentan.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {users.map((user) => {
              const isCurrentUser = currentUserId === user._id;
              const imageSrc = user.image || "";
              const initials = getUserInitials(user.name, user.email);

              return (
                <div
                  key={user._id}
                  className="grid md:grid-cols-[70px_1fr_auto] gap-4 border rounded-2xl p-4 items-center"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={user.name || user.email}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-gray-600">
                        {initials}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-lg">
                        {user.name || "Utilizator fără nume"}
                      </h3>

                      {user.admin && (
                        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-bold">
                          Admin
                        </span>
                      )}

                      {isCurrentUser && (
                        <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold">
                          Tu
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm">
                      {user.email || "Fără email"}
                    </p>

                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm text-gray-500">
                      <p>
                        <span className="font-semibold text-gray-700">
                          Oraș:
                        </span>{" "}
                        {user.city || "-"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-700">
                          Țară:
                        </span>{" "}
                        {user.country || "-"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-700">
                          Adresă:
                        </span>{" "}
                        {user.streetAddress || "-"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-700">
                          Cod poștal:
                        </span>{" "}
                        {user.postalCode || "-"}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-700">
                          Creat:
                        </span>{" "}
                        {formatDate(user.createdAt)}
                      </p>

                      <p>
                        <span className="font-semibold text-gray-700">
                          Actualizat:
                        </span>{" "}
                        {formatDate(user.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2">
                    {user.admin ? (
                      <button
                        type="button"
                        onClick={() => updateUserAdmin(user._id, false)}
                        disabled={updatingId === user._id || isCurrentUser}
                        className="!w-auto bg-red-500 text-white border-0 rounded-full px-5 py-2 font-semibold disabled:opacity-50"
                      >
                        {updatingId === user._id
                          ? "Se modifică..."
                          : "Scoate admin"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateUserAdmin(user._id, true)}
                        disabled={updatingId === user._id}
                        className="!w-auto bg-primary text-white border-0 rounded-full px-5 py-2 font-semibold disabled:opacity-50"
                      >
                        {updatingId === user._id
                          ? "Se modifică..."
                          : "Fă admin"}
                      </button>
                    )}

                    {isCurrentUser && (
                      <p className="text-xs text-gray-400 text-center">
                        Contul curent
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}