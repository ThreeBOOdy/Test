import type { KnowledgePoint } from "@/lib/domain/types";
import { buildKnowledgeTree, type KnowledgeTreeNode } from "@/lib/domain/knowledge-tree";

export const KNOWLEDGE_MAP_MIN_ANSWERS = 3;
export const KNOWLEDGE_MAP_ACCURACY_THRESHOLD = 80;

export type KnowledgeMapStatus = "unvisited" | "weak" | "mastered";

export type KnowledgeMapStats = {
  answered: number;
  correct: number;
  hasUnmasteredWrong: boolean;
};

export type KnowledgeMapNode = Omit<KnowledgeTreeNode, "children"> & {
  children: KnowledgeMapNode[];
  status: KnowledgeMapStatus;
  answered: number;
  correct: number;
  accuracy: number;
  hasPractice: boolean;
  practiceHref?: string;
};

export type KnowledgeMapSummary = {
  total: number;
  mastered: number;
  weak: number;
  unvisited: number;
};

export type PublicKnowledgeMap = {
  nodes: KnowledgeMapNode[];
  stats: KnowledgeMapSummary;
  thresholds: { minAnswers: number; accuracy: number };
  mapEnabled: boolean;
};

const EMPTY_STATS: KnowledgeMapStats = { answered: 0, correct: 0, hasUnmasteredWrong: false };

export function deriveKnowledgeMapStatus(
  stats: KnowledgeMapStats,
  minAnswers = KNOWLEDGE_MAP_MIN_ANSWERS,
  accuracyThreshold = KNOWLEDGE_MAP_ACCURACY_THRESHOLD,
): KnowledgeMapStatus {
  if (stats.answered === 0) return "unvisited";
  if (stats.hasUnmasteredWrong) return "weak";
  const accuracy = Math.round((stats.correct / stats.answered) * 100);
  if (stats.answered >= minAnswers && accuracy >= accuracyThreshold) return "mastered";
  return "weak";
}

export function decorateKnowledgeMap(
  points: readonly KnowledgePoint[],
  statsById: ReadonlyMap<string, KnowledgeMapStats>,
  practiceHrefs: ReadonlyMap<string, string>,
  mapEnabled: boolean,
  minAnswers = KNOWLEDGE_MAP_MIN_ANSWERS,
  accuracyThreshold = KNOWLEDGE_MAP_ACCURACY_THRESHOLD,
): PublicKnowledgeMap {
  const roots = buildKnowledgeTree(points);
  const aggregateById = new Map<string, KnowledgeMapStats>();

  const computeAggregate = (node: KnowledgeTreeNode): KnowledgeMapStats => {
    const direct = statsById.get(node.id) ?? EMPTY_STATS;
    const aggregate = { ...direct };
    for (const child of node.children) {
      const childAggregate = computeAggregate(child);
      aggregate.answered += childAggregate.answered;
      aggregate.correct += childAggregate.correct;
      aggregate.hasUnmasteredWrong = aggregate.hasUnmasteredWrong || childAggregate.hasUnmasteredWrong;
    }
    aggregateById.set(node.id, aggregate);
    return aggregate;
  };
  roots.forEach(computeAggregate);

  const decorate = (node: KnowledgeTreeNode): KnowledgeMapNode => {
    const stats = aggregateById.get(node.id) ?? EMPTY_STATS;
    const status = deriveKnowledgeMapStatus(stats, minAnswers, accuracyThreshold);
    const practiceHref = practiceHrefs.get(node.id);
    return {
      ...node,
      children: node.children.map(decorate),
      status,
      answered: stats.answered,
      correct: stats.correct,
      accuracy: stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0,
      hasPractice: Boolean(practiceHref),
      practiceHref,
    };
  };
  const decoratedRoots = roots.map(decorate);

  const summary: KnowledgeMapSummary = { total: 0, mastered: 0, weak: 0, unvisited: 0 };
  const count = (node: KnowledgeMapNode) => {
    summary.total += 1;
    summary[node.status] += 1;
    node.children.forEach(count);
  };
  decoratedRoots.forEach(count);

  return {
    nodes: decoratedRoots,
    stats: summary,
    thresholds: { minAnswers, accuracy: accuracyThreshold },
    mapEnabled,
  };
}
