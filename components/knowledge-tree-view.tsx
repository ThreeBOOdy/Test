"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, MoreHorizontal } from "lucide-react";
import type { KnowledgeTreeNode } from "@/lib/domain/knowledge-tree";
import { Button } from "@/components/ui/button";

export function KnowledgeTreeView({ nodes }: { nodes: KnowledgeTreeNode[] }) { return <div className="flex flex-col gap-2">{nodes.map((node) => <TreeRow key={node.id} node={node} />)}</div>; }
function TreeRow({ node }: { node: KnowledgeTreeNode }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return <div><div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 hover:bg-[var(--muted)]"><button type="button" onClick={() => setOpen(!open)} className="grid size-8 place-items-center rounded-lg text-[var(--muted-foreground)]" disabled={!hasChildren}>{hasChildren ? open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-4" />}</button><div className="grid size-9 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--primary)]">{open && hasChildren ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-extrabold">{node.code}</span><span className="truncate text-sm font-semibold">{node.name}</span></div><div className="mt-1 text-xs text-[var(--muted-foreground)]">深度 {node.depth + 1} · {hasChildren ? `${node.children.length} 个下级节点` : "末级知识点"}</div></div><Button variant="ghost" size="sm" aria-label="更多操作"><MoreHorizontal className="size-4" /></Button></div>{open && hasChildren ? <div className="ml-6 mt-2 flex flex-col gap-2 border-l border-[var(--border)] pl-4">{node.children.map((child) => <TreeRow key={child.id} node={child} />)}</div> : null}</div>;
}
