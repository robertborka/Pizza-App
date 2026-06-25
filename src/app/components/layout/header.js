"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "../AppContext";

const NAV_LINKS = [
  { href: "/", label: "Acasă" },
  { href: "/menu", label: "Meniu" },
  { href: "/ai-pizza", label: "AI Pizza" },
  { href: "/about", label: "Despre" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, onClick }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary px-4 py-2 text-white shadow-sm shadow-primary/20"
          : "rounded-full px-4 py-2 text-gray-600 hover:bg-orange-50 hover:text-primary transition"
      }
    >
      {label}
    </Link>
  );
}

export default function Header() {
  const { data: session, status } = useSession();
  const { cartCount, clearCartForLogout } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userName = session?.user?.name || session?.user?.email;
  const isAdmin = Boolean(session?.user?.admin);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function handleLogout() {
    clearCartForLogout();
    signOut({ callbackUrl: "/" });
  }

  return (
    <header className="sticky top-4 z-40">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="flex items-center gap-3 rounded-full pr-3 font-black text-gray-950"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl text-white shadow-sm shadow-primary/30">
              🍕
            </span>
            <span className="leading-tight">
              <span className="block text-base md:text-lg">TOP FAMILY</span>
              <span className="block text-xs tracking-[0.28em] text-primary">
                PIZZA
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-bold lg:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 text-sm font-bold lg:flex">
            <Link
              href="/cart"
              className="relative inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2.5 text-gray-700 hover:border-primary hover:text-primary transition"
            >
              Coș
              {cartCount > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {status === "loading" ? null : session ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="rounded-full px-4 py-2 text-gray-600 hover:bg-orange-50 hover:text-primary transition"
                  >
                    Admin
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="max-w-[180px] truncate rounded-full px-3 py-2 text-gray-600 hover:bg-orange-50 hover:text-primary transition"
                  title={userName || "Profil"}
                >
                  Salut, {userName}
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="!w-auto rounded-full border-0 bg-gray-950 px-6 py-2.5 text-white hover:bg-primary transition"
                >
                  Deconectare
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-4 py-2 text-gray-600 hover:bg-orange-50 hover:text-primary transition"
                >
                  Conectare
                </Link>

                <Link
                  href="/register"
                  className="rounded-full bg-primary px-6 py-2.5 text-white shadow-sm shadow-primary/25 hover:-translate-y-0.5 hover:shadow-md transition"
                >
                  Înregistrare
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/cart"
              onClick={closeMobileMenu}
              className="relative inline-flex h-11 items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700"
            >
              Coș
              {cartCount > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="!h-11 !w-11 rounded-full border border-gray-200 bg-white p-0 text-xl font-black text-gray-900"
              aria-label="Deschide meniul"
            >
              {mobileOpen ? "×" : "☰"}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="mt-4 rounded-[1.5rem] border border-gray-100 bg-white p-3 shadow-sm lg:hidden">
            <nav className="grid gap-2 text-sm font-bold">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  onClick={closeMobileMenu}
                />
              ))}
            </nav>

            <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-sm font-bold">
              {status === "loading" ? null : session ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin/dashboard"
                      onClick={closeMobileMenu}
                      className="rounded-full bg-orange-50 px-4 py-3 text-primary"
                    >
                      Admin
                    </Link>
                  )}

                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="rounded-full bg-gray-50 px-4 py-3 text-gray-700"
                  >
                    Profil: {userName}
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="!w-full rounded-full border-0 bg-gray-950 px-5 py-3 text-white"
                  >
                    Deconectare
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="rounded-full bg-gray-50 px-4 py-3 text-gray-700"
                  >
                    Conectare
                  </Link>

                  <Link
                    href="/register"
                    onClick={closeMobileMenu}
                    className="rounded-full bg-primary px-4 py-3 text-center text-white"
                  >
                    Înregistrare
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
