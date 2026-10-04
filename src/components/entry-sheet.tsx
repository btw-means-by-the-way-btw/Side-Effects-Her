"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import {useT} from "./preferences-provider";
export function EntrySheet({ title, description, trigger, children, icon = "plus", triggerClass = "button-primary", autoOpen = false }: { title: string; description: string; trigger: string; children: ReactNode; icon?: IconName; triggerClass?: string; autoOpen?: boolean }) {
  const t=useT();
  const dialog = useRef<HTMLDialogElement>(null), button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId(), descriptionId = useId(), panelId = useId();
  function show() { dialog.current?.showModal(); setOpen(true); }
  function close() { dialog.current?.close(); setOpen(false); }
  useEffect(() => { if (autoOpen) { dialog.current?.showModal(); setOpen(true); } }, [autoOpen]);
  useEffect(() => { if (!open) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, [open]);
  return <><button ref={button} type="button" className={triggerClass} onClick={show} aria-haspopup="dialog" aria-controls={panelId}><Icon name={icon} />{t(trigger)}</button><dialog ref={dialog} id={panelId} className="entry-sheet" aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => { setOpen(false); button.current?.focus(); }} onCancel={() => setOpen(false)} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); }}><div className="sheet-handle" aria-hidden="true" /><div className="sheet-content"><div className="sheet-heading"><h2 id={titleId}>{t(title)}</h2><button type="button" className="sheet-close" aria-label={t("Zamknij panel")} onClick={close}><Icon name="close" /></button></div><p id={descriptionId} className="sheet-description">{t(description)}</p>{children}</div></dialog></>;
}
