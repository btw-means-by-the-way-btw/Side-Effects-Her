"use client";
import { createContext,useContext,useEffect,type ReactNode } from "react";
import { translate,type Locale } from "@/lib/i18n";
const LocaleContext=createContext<Locale>("pl");
export function PreferencesProvider({locale,theme,children}:{locale:Locale;theme:"light"|"dark"|"system";children:ReactNode}) {
  useEffect(()=>{const media=matchMedia("(prefers-color-scheme: dark)");const apply=()=>{document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;};apply();media.addEventListener("change",apply);return()=>media.removeEventListener("change",apply);},[theme]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export const useLocale=()=>useContext(LocaleContext);
export function useT(){const locale=useLocale();return (text:string)=>translate(text,locale);}
export function T({text}:{text:string}){return <>{translate(text,useLocale())}{" "}</>;}
export function DateText({value}:{value:string|null}){const locale=useLocale();if(!value)return null;const iso=/^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:value.slice(0,10);const date=new Date(`${iso}T12:00:00Z`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(locale==="en"?"en-GB":"pl-PL",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(date);}
