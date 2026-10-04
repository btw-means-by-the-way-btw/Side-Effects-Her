import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion";
import "./globals.css";
import { getAccount } from "@/lib/auth";
import { PreferencesProvider } from "@/components/preferences-provider";
import { translate } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const account = await getAccount();
  return {
    title: "Side Effects Her",
    description: translate("Osobisty dziennik leków i objawów do rozmowy z lekarzem.", account?.locale ?? "pl"),
    icons: {
      icon: { url: "/brand/sideeffecther-app-icon.png", type: "image/png" },
      apple: "/brand/sideeffecther-app-icon.png",
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getAccount();
  return (
    <html data-scroll-behavior="smooth" lang={account?.locale ?? "pl"} data-theme={account?.theme === "dark" ? "dark" : "light"} suppressHydrationWarning>
      <body><PreferencesProvider locale={account?.locale ?? "pl"} theme={account?.theme ?? "light"}><Suspense fallback={null}><AppHeader signedIn={Boolean(account)} /></Suspense><div className="application-content"><Suspense fallback={children}><PageTransition>{children}</PageTransition></Suspense></div></PreferencesProvider></body>
    </html>
  );
}

