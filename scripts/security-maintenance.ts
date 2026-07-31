import { purgeExpiredStudentActivations } from "@/lib/server/student-activation-service";

function parseRetentionDays(value: string | undefined) {
  const parsed = value === undefined ? 7 : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("ACTIVATION_RETENTION_DAYS 必须是非负整数");
  return parsed;
}

async function main() {
  const result = await purgeExpiredStudentActivations(parseRetentionDays(process.env.ACTIVATION_RETENTION_DAYS));
  console.log(JSON.stringify(result));
}

void main();
