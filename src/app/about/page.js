import Image from "next/image";
import Link from "next/link";
import SectionHeaders from "../components/layout/sectionHeaders";
import { restaurantInfo, restaurantFullAddress } from "@/libs/restaurantInfo";

const experienceItems = [
  {
    icon: "🍕",
    title: "Meniu ușor de parcurs",
    description:
      "Produsele sunt afișate clar, cu imagine, descriere și preț, astfel încât alegerea să fie rapidă.",
  },
  {
    icon: "🛒",
    title: "Comandă online simplă",
    description:
      "Clientul adaugă produsele în coș, completează datele de livrare și trimite comanda fără pași inutili.",
  },
  {
    icon: "✨",
    title: "Recomandări utile",
    description:
      "Aplicația poate sugera produse potrivite în funcție de selecția din coș sau de imaginea încărcată.",
  },
  {
    icon: "📍",
    title: "Estimare de livrare",
    description:
      "După plasarea comenzii, sunt afișate ruta restaurant - client, distanța și timpul aproximativ.",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Alegi ce îți place",
    description: "Răsfoiești meniul și selectezi produsele dorite.",
  },
  {
    step: "02",
    title: "Completezi comanda",
    description: "Adaugi datele de contact și adresa de livrare.",
  },
  {
    step: "03",
    title: "Trimiți comanda",
    description: "Comanda este salvată și poate fi urmărită din cont.",
  },
  {
    step: "04",
    title: "Primești estimarea",
    description: "Vezi timpul aproximativ de pregătire și livrare.",
  },
];

export default function AboutPage() {
  const encodedAddress = encodeURIComponent(restaurantFullAddress);

  return (
    <section className="mt-8 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-24 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-white border border-primary/20 rounded-full px-5 py-2 shadow-sm mb-4">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-bold text-primary">
            Platformă pentru comenzi online
          </span>
        </div>

        <SectionHeaders subHeader="povestea noastră" mainHeader="Despre noi" />

        <p className="text-gray-500 mt-4 max-w-3xl mx-auto leading-7">
          Top Family Pizza este o platformă de comenzi online pentru pizza,
          sosuri, băuturi și deserturi, cu administrare internă a meniului,
          recomandări inteligente și estimare de livrare.
        </p>
      </div>

      <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-10 items-center mb-16">
        <div>
          <p className="text-primary font-bold uppercase tracking-wide mb-3">
            {restaurantInfo.name}
          </p>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
            Comenzi online clare, produse bine prezentate și livrare estimată.
          </h1>

          <div className="space-y-5 text-gray-600 leading-8">
            <p>
              Platforma este gândită pentru clienții care vor să comande rapid,
              fără meniuri aglomerate și fără pași confuzi. Produsele sunt
              grupate pe categorii, iar fiecare produs are imagine, descriere și
              preț afișat clar.
            </p>

            <p>
              Experiența este construită în jurul comenzii: alegi produsele,
              le adaugi în coș, completezi adresa și vezi o estimare de livrare
              după trimiterea comenzii.
            </p>

            <p>
              Restaurantul folosește adresa <strong>{restaurantFullAddress}</strong>{" "}
              pentru calcularea rutei și afișarea timpului aproximativ de drum
              dintre restaurant și client.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Link
              href="/menu"
              className="bg-primary text-white rounded-full px-8 py-3 font-bold text-center shadow-sm hover:shadow-lg hover:shadow-primary/30 transition"
            >
              Vezi meniul
            </Link>

            <Link
              href="/ai-pizza"
              className="border border-gray-300 text-gray-700 rounded-full px-8 py-3 font-bold text-center bg-white hover:border-primary/50 hover:bg-orange-50 transition"
            >
              Încearcă AI Pizza
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-orange-100/70 to-white rounded-[2.5rem] blur-xl" />

          <div className="relative bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
            <div className="absolute right-6 top-6 rounded-full bg-primary/10 px-4 py-2 text-primary text-sm font-bold">
              Comenzi rapide
            </div>

            <div className="relative h-[420px] flex items-center justify-center pt-8">
              <Image
                src="/pizza.png"
                width={430}
                height={430}
                alt="Pizza Top Family Pizza"
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 mb-16">
        <div className="text-center mb-8">
          <p className="text-primary font-bold uppercase tracking-wide mb-2">
            Experiență pentru client
          </p>

          <h2 className="text-3xl font-bold text-gray-900">
            Ce găsești în platformă
          </h2>

          <p className="text-gray-500 max-w-2xl mx-auto mt-3 leading-7">
            Totul este organizat pentru o comandă clară: meniu vizual, coș,
            recomandări și estimare de livrare.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {experienceItems.map((item) => (
            <div
              key={item.title}
              className="bg-gray-50 rounded-3xl p-6 border border-gray-100 hover:bg-white hover:shadow-lg transition"
            >
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl mb-4 shadow-sm">
                {item.icon}
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {item.title}
              </h3>

              <p className="text-gray-600 leading-7">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative grid lg:grid-cols-[0.9fr_1.1fr] gap-10 mb-16">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100">
          <p className="text-primary font-bold uppercase tracking-wide mb-2">
            Funcții utile
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Recomandări și livrare într-un singur flux
          </h2>

          <p className="text-gray-600 leading-7 mb-6">
            Platforma poate ajuta clientul să aleagă produse potrivite, să
            completeze comanda și să vadă informațiile importante despre
            livrare după plasarea acesteia.
          </p>

          <div className="flex flex-col gap-4">
            <div className="bg-orange-50 border border-primary/20 rounded-3xl p-5">
              <h3 className="font-bold text-gray-900 mb-2">
                AI Pizza
              </h3>
              <p className="text-gray-600 leading-7">
                Clientul poate încărca o imagine, iar aplicația recomandă
                produse apropiate din meniu pe baza elementelor vizibile.
              </p>
            </div>

            <div className="bg-orange-50 border border-primary/20 rounded-3xl p-5">
              <h3 className="font-bold text-gray-900 mb-2">
                Estimare livrare
              </h3>
              <p className="text-gray-600 leading-7">
                După comandă, aplicația afișează ruta restaurant - client,
                distanța și timpul aproximativ de sosire.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 text-white rounded-[2rem] p-6 md:p-8 shadow-sm overflow-hidden relative">
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary/30 rounded-full blur-3xl" />

          <div className="relative">
            <p className="text-primary font-bold uppercase tracking-wide mb-2">
              Flux comandă
            </p>

            <h2 className="text-3xl font-bold mb-6">
              De la meniu la livrare
            </h2>

            <div className="flex flex-col gap-5">
              {processSteps.map((item) => (
                <div
                  key={item.step}
                  className="grid grid-cols-[60px_1fr] gap-4 items-start"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white text-primary flex items-center justify-center font-bold">
                    {item.step}
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-1">{item.title}</h3>

                    <p className="text-gray-300 leading-7">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 mb-16">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8">
          <div>
            <p className="text-primary font-bold uppercase tracking-wide mb-2">
              Unde ne găsești
            </p>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Restaurantul Top Family Pizza
            </h2>

            <p className="text-gray-600 leading-7 mb-6">
              Adresa restaurantului este folosită pentru ruta de livrare și
              pentru estimarea timpului aproximativ până la client.
            </p>

            <div className="flex flex-col gap-4">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-gray-500 text-sm mb-1">Adresă</p>
                <p className="font-bold text-gray-900">
                  {restaurantFullAddress}
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-gray-500 text-sm mb-1">Program</p>
                <p className="font-bold text-gray-900">
                  Luni - Vineri: {restaurantInfo.schedule.mondayFriday}
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-gray-500 text-sm mb-1">Telefon</p>
                <a
                  href={`tel:${restaurantInfo.phone.replaceAll(" ", "")}`}
                  className="font-bold text-primary"
                >
                  {restaurantInfo.phone}
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-3xl overflow-hidden border border-gray-200 bg-gray-100 min-h-[420px]">
            <iframe
              title="Harta Top Family Pizza"
              src={`https://www.google.com/maps?q=${encodedAddress}&output=embed`}
              className="w-full h-[420px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-r from-primary to-orange-600 rounded-[2rem] p-8 md:p-10 text-white text-center shadow-sm">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Comandă pizza rapid, simplu și fără pași inutili.
        </h2>

        <p className="max-w-2xl mx-auto text-white/90 leading-7 mb-8">
          Alege produsele preferate, adaugă-le în coș și urmărește estimarea
          livrării după plasarea comenzii.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/menu"
            className="bg-white text-primary rounded-full px-8 py-3 font-bold text-center"
          >
            Vezi meniul
          </Link>

          <Link
            href="/contact"
            className="border border-white/50 text-white rounded-full px-8 py-3 font-bold text-center hover:bg-white/10 transition"
          >
            Contact
          </Link>
        </div>
      </div>
    </section>
  );
}
