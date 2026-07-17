import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KnowledgeTreeView } from "@/components/knowledge-tree-view";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { knowledgePoints } from "@/lib/data/demo";
import { buildKnowledgeTree } from "@/lib/domain/knowledge-tree";

export default function KnowledgePage() { return <AppShell role="teacher" currentPath="/teacher/knowledge"><div className="safe-bottom"><PageHeader title="知识点目录" description="分类号自动形成树形关系。父级知识点练习会包含它的全部后代知识点。" action={<Button><Plus className="size-4" />新增知识点</Button>} /><Card><CardContent><label className="mb-5 flex h-11 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input className="w-full bg-transparent text-sm outline-none" placeholder="搜索分类号或知识点名称" /></label><KnowledgeTreeView nodes={buildKnowledgeTree(knowledgePoints)} /></CardContent></Card></div></AppShell>; }
