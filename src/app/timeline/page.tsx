import { WorkspacePage } from "@/components/workspace-page";
export default function History({ searchParams }: { searchParams: Promise<{ med?: string; saved?: string; error?: string }> }) { return <WorkspacePage searchParams={searchParams} mode="history" />; }
