"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
export function PageTransition({ children }: { children: ReactNode }) { const pathname = usePathname(); const query = useSearchParams(); return <div className="page-transition" key={`${pathname}:${query.get("med") ?? ""}:${query.get("saved") ?? ""}`}>{children}</div>; }
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches || !window.IntersectionObserver) return;
    element.classList.add("reveal-pending");
    // Long source sections may never occupy 5% of their own area in a phone viewport.
    const observer = new IntersectionObserver(entries => { if (!entries.some(entry => entry.isIntersecting)) return; element.classList.remove("reveal-pending"); element.classList.add("reveal-visible"); observer.disconnect(); }, { threshold: 0 });
    observer.observe(element);
    const showForKeyboard = () => element.classList.remove("reveal-pending");
    element.addEventListener("focusin", showForKeyboard);
    return () => { observer.disconnect(); element.classList.remove("reveal-pending"); element.removeEventListener("focusin", showForKeyboard); };
  }, []);
  return <div ref={ref} className={`motion-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}
