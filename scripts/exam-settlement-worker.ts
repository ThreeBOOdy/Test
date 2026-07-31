import { settleExpiredMockExams } from "@/lib/server/practice-service";

const intervalMs = 15_000;

async function settle() {
  const count = await settleExpiredMockExams();
  if (count) console.info(`Settled ${count} expired mock exam session${count === 1 ? "" : "s"}.`);
}

async function run() {
  await settle();
  setInterval(() => { void settle().catch((error: unknown) => console.error("Mock exam settlement failed", error)); }, intervalMs);
}

void run().catch((error: unknown) => {
  console.error("Mock exam settlement worker failed to start", error);
  process.exitCode = 1;
});
