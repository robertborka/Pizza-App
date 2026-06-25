import "leaflet/dist/leaflet.css";
import "./globals.css";
import Header from "./components/layout/header";
import Providers from "./providers";
import AiChatbot from "./components/ai/AiChatbot";
import Footer from "./components/layout/footer";

export const metadata = {
  title: "Top Family Pizza",
  description:
    "Comenzi pizza online, recomandări utile, coș rapid și estimare de livrare.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body className="bg-orange-50 text-gray-900">
        <Providers>
          <main className="mx-auto max-w-6xl p-4">
            <Header />

            {children}

            <Footer />
          </main>

          <AiChatbot />
        </Providers>
      </body>
    </html>
  );
}