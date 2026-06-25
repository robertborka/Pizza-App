import Link from "next/link";
import Hero from "./components/layout/hero";
import HomeMenu from "./components/layout/homemenu";
import SectionHeaders from "./components/layout/sectionHeaders";

const premiumFeatures = [
  {
    title: "Comenzi rapide",
    description:
      "Alegi produsele, completezi datele de livrare și trimiți comanda într-un flux simplu, fără pași inutili.",
    icon: "🛒",
  },
  {
    title: "Recomandări utile",
    description:
      "Primești sugestii potrivite în funcție de produsele selectate, ca să completezi mai ușor comanda.",
    icon: "✨",
  },
  {
    title: "Estimare livrare",
    description:
      "După plasarea comenzii, vezi distanța, ruta și timpul aproximativ până la destinație.",
    icon: "📍",
  },
];

const orderSteps = [
  {
    step: "01",
    title: "Alegi produsele",
    description: "Răsfoiești meniul și adaugi în coș pizza, sosuri, băuturi sau deserturi.",
  },
  {
    step: "02",
    title: "Completezi datele",
    description: "Introduci adresa de livrare și datele de contact necesare pentru comandă.",
  },
  {
    step: "03",
    title: "Trimiți comanda",
    description: "Comanda este salvată, iar statusul poate fi urmărit din contul tău.",
  },
  {
    step: "04",
    title: "Vezi estimarea",
    description: "Aplicația afișează timpul aproximativ, distanța și traseul de livrare.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="my-16">
        <div className="grid lg:grid-cols-3 gap-5">
          {premiumFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group bg-white rounded-[2rem] p-7 border border-gray-100 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-5 group-hover:bg-primary group-hover:text-white transition">
                {feature.icon}
              </div>

              <h2 className="text-xl font-bold text-gray-950 mb-3">
                {feature.title}
              </h2>

              <p className="text-gray-500 leading-7">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="my-20">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-stretch">
          <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-gray-100">
            <p className="text-primary font-bold uppercase text-sm mb-3">
              Top Family Pizza
            </p>

            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Gust bun, comandă clară și livrare urmărită simplu.
            </h2>

            <p className="text-gray-600 leading-8 mt-5">
              Platforma pune meniul, coșul, recomandările și estimarea livrării
              într-un singur flux. Clientul vede produsele, alege ce dorește și
              finalizează comanda fără meniuri încărcate sau pași confuzi.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-7">
              <div className="rounded-3xl bg-orange-50 border border-primary/10 p-5">
                <div className="text-3xl mb-3">🍕</div>
                <h3 className="font-bold text-gray-900">Meniu clar</h3>
                <p className="text-sm text-gray-500 mt-2 leading-6">
                  Produsele sunt grupate pe categorii, cu imagine, descriere și
                  preț afișat clar.
                </p>
              </div>

              <div className="rounded-3xl bg-orange-50 border border-primary/10 p-5">
                <div className="text-3xl mb-3">🧭</div>
                <h3 className="font-bold text-gray-900">Livrare estimată</h3>
                <p className="text-sm text-gray-500 mt-2 leading-6">
                  După comandă, aplicația afișează ruta, distanța și timpul
                  aproximativ de sosire.
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] bg-gray-900 min-h-[380px] shadow-sm border border-gray-100">
            <div
              className="absolute inset-0 bg-cover bg-center scale-105"
              style={{
                backgroundImage: "url('/home/wood-fired-pizza-hero.png')",
              }}
            />

            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10" />

            <div className="relative z-10 h-full p-8 md:p-10 flex flex-col justify-end">
              <div className="inline-flex w-fit items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 mb-5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-white text-sm font-bold">
                  Comandă online simplă
                </span>
              </div>

              <h2 className="text-white text-3xl md:text-5xl font-bold leading-tight max-w-xl">
                Tot ce contează pentru o comandă bună, într-un singur loc.
              </h2>

              <p className="text-white/80 leading-8 mt-5 max-w-xl">
                Meniu vizual, coș rapid, date de livrare salvate în cont și o
                estimare clară după plasarea comenzii.
              </p>
            </div>
          </div>
        </div>
      </section>

      <HomeMenu />

      <section className="my-20">
        <div className="text-center mb-10">
          <SectionHeaders
            subHeader="Funcții utile"
            mainHeader="O experiență mai ușoară pentru client"
          />

          <p className="text-gray-500 max-w-2xl mx-auto mt-4 leading-7">
            Platforma ajută clientul să aleagă mai ușor, să finalizeze comanda
            mai repede și să urmărească informațiile importante după plasarea ei.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-[2rem] p-7 border border-gray-100 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-5">
              📸
            </div>

            <h3 className="font-bold text-xl text-gray-900">
              AI Pizza
            </h3>

            <p className="text-gray-500 leading-7 mt-3">
              Încarci o imagine cu o pizza, iar aplicația analizează elementele
              vizibile și recomandă produse apropiate din meniu.
            </p>

            <Link
              href="/ai-pizza"
              className="inline-block mt-6 bg-primary text-white rounded-full px-6 py-3 font-bold"
            >
              Încearcă AI Pizza
            </Link>
          </div>

          <div className="bg-white rounded-[2rem] p-7 border border-gray-100 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-5">
              🛒
            </div>

            <h3 className="font-bold text-xl text-gray-900">
              Recomandări în coș
            </h3>

            <p className="text-gray-500 leading-7 mt-3">
              Pe baza produselor selectate, aplicația poate sugera completări
              potrivite, precum sosuri, băuturi sau deserturi.
            </p>

            <Link
              href="/cart"
              className="inline-block mt-6 border border-gray-300 text-gray-700 rounded-full px-6 py-3 font-bold"
            >
              Vezi coșul
            </Link>
          </div>

          <div className="bg-white rounded-[2rem] p-7 border border-gray-100 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-5">
              🗺️
            </div>

            <h3 className="font-bold text-xl text-gray-900">
              Rută de livrare
            </h3>

            <p className="text-gray-500 leading-7 mt-3">
              După plasarea comenzii, vezi ruta restaurant - client, distanța
              și timpul aproximativ de drum.
            </p>

            <Link
              href="/menu"
              className="inline-block mt-6 border border-gray-300 text-gray-700 rounded-full px-6 py-3 font-bold"
            >
              Comandă acum
            </Link>
          </div>
        </div>
      </section>

      <section className="my-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gray-950 p-8 md:p-12 text-white">
          <div className="absolute -right-24 -top-24 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
          <div className="absolute -left-24 -bottom-24 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl" />

          <div className="relative grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
            <div>
              <p className="uppercase text-primary font-bold mb-3">
                Proces simplu
              </p>

              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                De la meniu la comandă finalizată.
              </h2>

              <p className="text-gray-300 leading-8 mt-5">
                Fluxul este construit pentru clienți: alegi produsele, verifici
                coșul, completezi adresa și urmărești estimarea livrării după
                trimiterea comenzii.
              </p>

              <div className="flex flex-wrap gap-4 mt-8">
                <Link
                  href="/menu"
                  className="bg-primary text-white rounded-full px-8 py-3 font-bold"
                >
                  Vezi meniul
                </Link>

                <Link
                  href="/about"
                  className="bg-white/10 border border-white/20 text-white rounded-full px-8 py-3 font-bold"
                >
                  Despre noi
                </Link>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {orderSteps.map((item) => (
                <div
                  key={item.step}
                  className="bg-white/10 rounded-3xl p-5 border border-white/10"
                >
                  <p className="text-primary font-black text-2xl mb-4">
                    {item.step}
                  </p>

                  <p className="font-bold text-lg">{item.title}</p>

                  <p className="text-sm text-gray-300 mt-2 leading-6">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
