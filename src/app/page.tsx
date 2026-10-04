import { WorkspacePage } from "@/components/workspace-page";
export default function Home({ searchParams }: { searchParams: Promise<{ med?: string; saved?: string; error?: string }> }) { return <WorkspacePage searchParams={searchParams} />; }
