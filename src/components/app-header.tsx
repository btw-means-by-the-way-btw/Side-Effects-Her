"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "./icon";
import { useT } from "./preferences-provider";
const links: Array<{ href: string; label: string; icon: IconName }> = [{ href: "/", label: "Leki", icon: "pill" }, { href: "/timeline", label: "Historia", icon: "timeline" }, { href: "/what-we-know", label: "Wiedza", icon: "book" }, { href: "/cycle", label: "Cykl", icon: "cycle" }, { href: "/charts", label: "Wykresy", icon: "chart" }];
function Brand() { const t=useT(); return <Link href="/" className="brand" aria-label={`Side Effects Her — ${t("Twoje leki")}`}><span className="brand-symbol"><Image src="/brand/sideeffecther-app-icon.png" alt="" width={34} height={34} sizes="34px" priority /></span><span>Side Effects <em>Her</em></span></Link>; }
export function AppHeader({signedIn}:{signedIn:boolean}) {
  const t=useT();
  const pathname = usePathname(), params = useSearchParams(), med = params.get("med");
  const [lastMedication, setLastMedication] = useState<string | null>(null);
  useEffect(() => { try { if (med) { sessionStorage.setItem("sideeffecther_selected_medication", med); setLastMedication(med); } else setLastMedication(sessionStorage.getItem("sideeffecther_selected_medication")); } catch { setLastMedication(med); } }, [med]);
  const selected = med ?? lastMedication;
  const active = pathname === "/timeline" || pathname === "/context" ? 1 : pathname === "/what-we-know" ? 2 : pathname === "/cycle" ? 3 : pathname === "/charts" ? 4 : 0;
  const navigation = (className: string, label: string) => {
    const mobile = className === "bottom-nav";
    const items = mobile ? [...links, { href: "/settings", label: "Konto", icon: "lock" as const }] : links;
    const current = mobile && pathname === "/settings" ? links.length : active;
    return <nav className={className} aria-label={t(label)} style={{ "--nav-index": current, "--nav-count": items.length } as CSSProperties}><span className="nav-active" aria-hidden="true" />{items.map((link, index) => <Link key={link.href} href={selected && link.href !== "/settings" ? `${link.href}?med=${encodeURIComponent(selected)}` : link.href} aria-current={current === index ? "page" : undefined} className="nav-button"><Icon name={link.icon} /><span>{t(link.label)}</span></Link>)}</nav>;
  };
  return <><aside className="desktop-sidebar"><Brand /><p className="sidebar-caption">{t("Twój osobisty dziennik")}</p>{signedIn&&navigation("side-nav", "Nawigacja główna")}<Link href={signedIn?"/settings":"/login"} className="account-nav"><Icon name="lock"/>{t(signedIn?"Konto":"Zaloguj się")}</Link><div className="sidebar-footer"><p>{t("Twoja historia")}<br />{t("ma znaczenie.")}</p><span>{t("Miejsce na to, co czujesz.")}<br />{t("I na informacje ze źródeł.")}</span></div></aside><header className="app-topbar"><Brand /></header>{signedIn&&navigation("bottom-nav", "Nawigacja mobilna")}</>;
}

