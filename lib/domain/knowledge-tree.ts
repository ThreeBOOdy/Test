import type { KnowledgePoint } from "@/lib/domain/types";

export type KnowledgeTreeNode = KnowledgePoint & { children: KnowledgeTreeNode[] };

export function buildKnowledgeTree(points: readonly KnowledgePoint[]): KnowledgeTreeNode[] {
  const nodes = new Map<string, KnowledgeTreeNode>();
  for (const point of points) nodes.set(point.id, { ...point, children: [] });

  const roots: KnowledgeTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }

  const sort = (items: KnowledgeTreeNode[]) => {
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
    items.forEach((item) => sort(item.children));
  };
  sort(roots);
  return roots;
}

export function getDescendantIds(points: readonly KnowledgePoint[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const point of points) {
    if (!point.parentId) continue;
    const children = childrenByParent.get(point.parentId) ?? [];
    children.push(point.id);
    childrenByParent.set(point.parentId, children);
  }

  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }
  return result;
}
