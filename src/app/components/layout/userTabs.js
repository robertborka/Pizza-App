"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function TabLink({ href, children }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={
        active
          ? "bg-primary text-white rounded-full px-5 py-3 font-bold shadow-sm"
          : "bg-white text-gray-700 border border-gray-200 rounded-full px-5 py-3 font-bold hover:border-primary hover:text-primary transition"
      }
    >
      {children}
    </Link>
  );
}

export default function UserTabs({ isAdmin }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <TabLink href="/profile">Profil</TabLink>

      <TabLink href="/my-orders">Comenzile mele</TabLink>

      {isAdmin && (
        <>
          <TabLink href="/admin/dashboard">Dashboard</TabLink>
          <TabLink href="/categories">Categorii</TabLink>
          <TabLink href="/menu-items">Produse</TabLink>
          <TabLink href="/ingredients">Ingrediente</TabLink>
          <TabLink href="/users">Utilizatori</TabLink>
          <TabLink href="/orders">Comenzi</TabLink>
        </>
      )}
    </div>
  );
}