import type { ReactNode } from "react";
import { T } from "./preferences-provider";
export function PageHeading({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent: string; children?: ReactNode }) { return <header className="page-heading"><div><p className="eyebrow text-muted-foreground"><T text={eyebrow}/></p><h1><T text={title}/><br /><em><T text={accent}/></em></h1>{children && <div className="heading-copy">{children}</div>}</div></header>; }
