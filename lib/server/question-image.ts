import "server-only";
import { prisma } from "@/lib/db";

export type QuestionImageContent = {
  id: string;
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
};

export async function getQuestionImage(id: string): Promise<QuestionImageContent | null> {
  const image = await prisma.questionImage.findFirst({
    where: { id },
    select: { id: true, data: true, mimeType: true, sizeBytes: true, contentHash: true },
  });
  if (!image) return null;
  return { ...image, data: Uint8Array.from(image.data) };
}
