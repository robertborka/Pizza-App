import Link from "next/link";
import Right from "../icons/right";

export default function Hero() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-[2.5rem] min-h-[620px] border border-white/60 shadow-[0_24px_80px_rgba(17,24,39,0.16)] bg-gray-950">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: "url('/home/wood-fired-pizza-hero.png')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/78 to-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

      <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 right-24 w-72 h-72 bg-orange-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-[620px] grid lg:grid-cols-[0.98fr_1.02fr] gap-8 items-center px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 shadow-sm mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />

            <span className="text-sm font-bold text-white">
              Comenzi online, recomandări utile și livrare estimată
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight text-white tracking-tight">
            Pizza online cu gust autentic și{" "}
            <span className="text-primary">experiență modernă.</span>
          </h1>

          <p className="my-6 text-white/85 text-lg leading-8 max-w-xl">
            Alege produsele preferate, adaugă-le rapid în coș și urmărește
            estimarea livrării după plasarea comenzii. Totul este simplu,
            clar și făcut pentru o comandă fără pași inutili.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/menu"
              className="bg-primary text-white px-8 py-3 rounded-full font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 transition"
            >
              Comandă acum
              <Right />
            </Link>

            <Link
              href="/ai-pizza"
              className="bg-white/10 backdrop-blur-md text-white border border-white/25 px-8 py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white hover:text-gray-900 hover:-translate-y-0.5 transition"
            >
              Încearcă AI Pizza
              <Right />
            </Link>
          </div>
        </div>

        <div className="relative hidden lg:flex min-h-[470px] items-center justify-end">
          <div className="w-full max-w-[440px] flex flex-col gap-4">
            <div className="bg-white/12 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-3xl">
                  🍕
                </div>

                <div>
                  <p className="text-white/60 text-sm">Top Family Pizza</p>
                  <h3 className="text-white font-bold text-xl">
                    Pizza, sosuri, băuturi și deserturi
                  </h3>
                </div>
              </div>

              <p className="text-white/80 leading-7 mt-4">
                Comanzi rapid, alegi produsele preferate și urmărești estimarea
                livrării după plasarea comenzii.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl px-5 py-4 shadow-2xl border border-white/70">
                <p className="text-sm text-gray-500">Recomandări</p>
                <p className="font-bold text-primary">produse potrivite</p>
              </div>

              <div className="bg-white rounded-3xl px-5 py-4 shadow-2xl border border-white/70">
                <p className="text-sm text-gray-500">Livrare</p>
                <p className="font-bold text-gray-900">rută estimată</p>
              </div>
            </div>

            <div className="bg-black/30 backdrop-blur-xl border border-white/15 rounded-[2rem] p-5">
              <p className="text-primary uppercase text-xs font-bold mb-3">
                Ce poți face
              </p>

              <div className="flex flex-wrap gap-2">
                <span className="bg-white/10 border border-white/15 text-white rounded-full px-4 py-2 text-sm font-semibold">
                  Comanzi online
                </span>

                <span className="bg-white/10 border border-white/15 text-white rounded-full px-4 py-2 text-sm font-semibold">
                  Primești recomandări
                </span>

                <span className="bg-white/10 border border-white/15 text-white rounded-full px-4 py-2 text-sm font-semibold">
                  Vezi ruta livrării
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
