"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import {T} from "./preferences-provider";
export function SaveButton({ children, className = "button-primary" }: { children: ReactNode; className?: string }) { const { pending } = useFormStatus(); return <button type="submit" className={`${className} w-full`} disabled={pending} aria-disabled={pending}>{pending ? <T text="Zapisuję…"/> : typeof children === "string" ? <T text={children}/> : children}<Icon name={pending ? "cycle" : "arrow"} className={pending ? "loading-icon" : ""} /></button>; }
