import "dotenv/config";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { importQuestionContentKey } from "@/lib/domain/question-import";

type LegacyQuestionRow = {
  id: string;
  externalQuestionCode: string | null;
  stem: string;
  options: unknown;
  correctOptionIds: unknown;
  levelCode: string | null;
};

async function main() {
  // 预检必须在迁移前运行：此时 Question.levelId 仍存在，QuestionLevel 尚未建表。
  // 因此这里使用原始 SQL 读取旧结构，避免依赖新 Prisma relation。
  const rows = await prisma.$queryRaw<LegacyQuestionRow[]>(Prisma.sql`
    SELECT q.\`id\`, q.\`externalQuestionCode\`, q.\`stem\`, q.\`options\`, q.\`correctOptionIds\`, l.\`code\` AS \`levelCode\`
    FROM \`Question\` q
    LEFT JOIN \`Level\` l ON l.\`id\` = q.\`levelId\`
    WHERE q.\`externalQuestionCode\` IS NOT NULL
    ORDER BY q.\`externalQuestionCode\` ASC
  `);

  const byCode = new Map<string, LegacyQuestionRow[]>();
  for (const row of rows) {
    if (!row.externalQuestionCode) continue;
    const code = row.externalQuestionCode.trim();
    const list = byCode.get(code) ?? [];
    list.push(row);
    byCode.set(code, list);
  }

  const duplicateGroups = [...byCode.entries()].filter(([, group]) => group.length > 1);
  if (duplicateGroups.length === 0) {
    console.log("S1 预检通过：未发现重复的全局题目编号（externalQuestionCode）。");
    await prisma.$disconnect();
    return;
  }

  console.log(`S1 预检发现 ${duplicateGroups.length} 个重复题目编号，需人工处理后才能执行迁移：\n`);
  for (const [code, group] of duplicateGroups) {
    const contentKeys = group.map((row) => importQuestionContentKey({ stem: row.stem, options: row.options, correctOptionIds: row.correctOptionIds }));
    const isExact = new Set(contentKeys).size === 1;
    console.log(`编号：${code}  [${isExact ? "EXACT 内容完全相同" : "CONFLICT 内容不同"}]`);
    for (const row of group) {
      console.log(`  - questionId: ${row.id}  字母类: ${row.levelCode ?? "未归类"}`);
    }
    console.log("");
  }

  console.log("处理建议：确认保留哪一道题，并将其他题目的 externalQuestionCode 置空或改为新编号后重跑本脚本。");
  await prisma.$disconnect();
  process.exitCode = 1;
}

main().catch(async (error) => {
  console.error("S1 预检失败：", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
