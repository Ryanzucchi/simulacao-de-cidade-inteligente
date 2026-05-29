import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "reactflow/dist/style.css";

export const metadata: Metadata = {
  title: "Smart City Command Center",
  description: "Plataforma IoT de Administração",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
