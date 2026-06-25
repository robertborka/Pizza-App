"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const adminRoutes = [
  "/orders",
  "/users",
  "/categories",
  "/menu-items",
  "/ingredients",
];

export default function AdminRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();

  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const isAdminRoute = useMemo(() => {
    return adminRoutes.some((route) => {
      return pathname === route || pathname.startsWith(`${route}/`);
    });
  }, [pathname]);

  useEffect(() => {
    async function checkAdminAccess() {
      if (!isAdminRoute) {
        return;
      }

      if (status === "loading") {
        return;
      }

      if (status === "unauthenticated") {
        router.replace("/login");
        return;
      }

      try {
        setCheckingAdmin(true);

        const res = await fetch("/api/profile", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.admin) {
          router.replace("/profile");
        }
      } catch (error) {
        console.error("ADMIN ROUTE GUARD ERROR:", error);
        router.replace("/profile");
      } finally {
        setCheckingAdmin(false);
      }
    }

    checkAdminAccess();
  }, [isAdminRoute, status, router]);

  if (!isAdminRoute || !checkingAdmin) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-6 text-center">
        <p className="font-semibold text-gray-700">
          Se verifică accesul de administrator...
        </p>
      </div>
    </div>
  );
}