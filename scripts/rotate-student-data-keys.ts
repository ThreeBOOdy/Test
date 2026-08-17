import { prisma } from "@/lib/db";
import { getStudentDataKeyring } from "@/lib/server/env";
import { decryptSensitiveValue, encryptSensitiveValue, isEncryptedWithCurrentSensitiveKey } from "@/lib/server/student-sensitive-data";

type Options = { batchSize: number; afterId?: string };
type RotationResult = { scanned: number; rotated: number; skipped: number; failed: number; nextAfterId: string | null; failedId: string | null };

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  const batchSize = Number(values.get("batch-size") ?? "100");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error("--batch-size must be an integer between 1 and 1000");
  const afterId = values.get("after-id");
  if (afterId !== undefined && !afterId) throw new Error("--after-id must not be empty");
  return { batchSize, afterId };
}

function keyId(value: string | null) {
  const parts = value?.split(".") ?? [];
  return parts[0] === "v2" && parts[1] ? parts[1] : "legacy";
}

async function rotateUser(user: { id: string; nationalIdEncrypted: string | null; phoneEncrypted: string | null }) {
  const nationalIdNeedsRotation = Boolean(user.nationalIdEncrypted && !isEncryptedWithCurrentSensitiveKey(user.nationalIdEncrypted));
  const phoneNeedsRotation = Boolean(user.phoneEncrypted && !isEncryptedWithCurrentSensitiveKey(user.phoneEncrypted));
  if (!nationalIdNeedsRotation && !phoneNeedsRotation) return "skipped" as const;

  const nationalIdEncrypted = nationalIdNeedsRotation && user.nationalIdEncrypted ? encryptSensitiveValue(decryptSensitiveValue(user.nationalIdEncrypted)) : undefined;
  const phoneEncrypted = phoneNeedsRotation && user.phoneEncrypted ? encryptSensitiveValue(decryptSensitiveValue(user.phoneEncrypted)) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { ...(nationalIdEncrypted ? { nationalIdEncrypted } : {}), ...(phoneEncrypted ? { phoneEncrypted } : {}) } });
    await tx.auditLog.create({
      data: {
        action: "STUDENT_SENSITIVE_DATA_KEY_ROTATION",
        targetType: "User",
        targetId: user.id,
        metadata: {
          currentKeyId: getStudentDataKeyring().currentKeyId,
          fields: [nationalIdEncrypted ? "nationalId" : null, phoneEncrypted ? "phone" : null].filter(Boolean),
          sourceKeyIds: { nationalId: nationalIdNeedsRotation ? keyId(user.nationalIdEncrypted) : null, phone: phoneNeedsRotation ? keyId(user.phoneEncrypted) : null },
          result: "SUCCESS",
        },
      },
    });
  });
  return "rotated" as const;
}

async function main() {
  const { batchSize, afterId } = parseOptions(process.argv.slice(2));
  getStudentDataKeyring();
  const users = await prisma.user.findMany({
    where: { id: afterId ? { gt: afterId } : undefined, OR: [{ nationalIdEncrypted: { not: null } }, { phoneEncrypted: { not: null } }] },
    select: { id: true, nationalIdEncrypted: true, phoneEncrypted: true },
    orderBy: { id: "asc" },
    take: batchSize,
  });
  const result: RotationResult = { scanned: 0, rotated: 0, skipped: 0, failed: 0, nextAfterId: afterId ?? null, failedId: null };
  for (const user of users) {
    result.scanned += 1;
    try {
      const state = await rotateUser(user);
      result[state] += 1;
      result.nextAfterId = user.id;
    } catch {
      result.failed = 1;
      result.failedId = user.id;
      try {
        await prisma.auditLog.create({ data: { action: "STUDENT_SENSITIVE_DATA_KEY_ROTATION", targetType: "User", targetId: user.id, metadata: { currentKeyId: getStudentDataKeyring().currentKeyId, result: "FAILED" } } });
      } catch {}
      break;
    }
  }
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}

void main().finally(() => prisma.$disconnect());
