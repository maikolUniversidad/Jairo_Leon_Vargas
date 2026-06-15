import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jairo León Vargas · UTL 360",
    template: "%s · Jairo León Vargas",
  },
  description:
    "Gestión social, participación ciudadana y trabajo comunitario para Bogotá y Colombia. Plataforma de atención ciudadana y trabajo territorial.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Jairo León Vargas",
    title: "Jairo León Vargas · Una voz desde el territorio",
    description:
      "Gestión social, participación ciudadana y trabajo comunitario para Bogotá y Colombia.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "UTL 360", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0e7490",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster />
        <PWARegister />
      </body>
    </html>
  );
}
