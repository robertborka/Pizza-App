import Link from "next/link";
import { restaurantInfo, restaurantFullAddress } from "@/libs/restaurantInfo";

const footerLinks = [
  { href: "/menu", label: "Meniu" },
  { href: "/ai-pizza", label: "AI Pizza" },
  { href: "/cart", label: "Coș" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="mt-16 overflow-hidden rounded-[2.5rem] border border-orange-100 bg-gray-950 text-white shadow-sm">
      <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:p-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl">
              🍕
            </span>
            <div>
              <p className="font-black text-lg">Top Family Pizza</p>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                comandă online
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-xl leading-7 text-white/65">
            Comenzi online pentru pizza, sosuri, băuturi și deserturi, cu recomandări utile și estimare de livrare după plasarea comenzii.
          </p>
        </div>

        <div>
          <p className="mb-4 font-black text-white">Navigare</p>
          <div className="grid gap-3 text-sm font-semibold text-white/65">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-primary transition">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-4 font-black text-white">Contact</p>
          <div className="grid gap-3 text-sm font-semibold text-white/65">
            <span>{restaurantFullAddress}</span>
            <a href={`tel:${restaurantInfo.phone.replace(/\s/g, "")}`} className="hover:text-primary transition">
              {restaurantInfo.phone}
            </a>
            <a href={`mailto:${restaurantInfo.email}`} className="hover:text-primary transition">
              {restaurantInfo.email}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-8 py-5 text-center text-sm font-semibold text-white/45 md:px-10">
        © 2025-2026 Top Family Pizza. Comenzi online și livrare estimată.
      </div>
    </footer>
  );
}
