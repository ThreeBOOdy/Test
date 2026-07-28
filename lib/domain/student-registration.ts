import { z } from "zod";
import { addCalendarYear, type StudentStatus } from "@/lib/domain/student-access";
import {
  deriveGenderFromNationalId,
  normalizeNationalId,
  normalizePhone,
  validateMainlandNationalId,
  validateMainlandPhone,
} from "@/lib/domain/student-identity";
import { validatePasswordPolicy } from "@/lib/domain/security";

const displayNameSchema = z.string().trim().min(1, "姓名不能为空").max(100, "姓名不能超过 100 位");
const schoolSchema = z.string().trim().min(1, "学校不能为空").max(200, "学校不能超过 200 位");
const gradeIdSchema = z.string().trim().min(1, "请选择启用的年级").max(191, "年级标识过长");

const nationalIdSchema = z
  .string()
  .transform(normalizeNationalId)
  .refine(validateMainlandNationalId, "请输入有效的 18 位中国大陆居民身份证号");

const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine(validateMainlandPhone, "请输入有效的中国大陆手机号");

const passwordSchema = z.string().superRefine((password, context) => {
  const message = validatePasswordPolicy(password);
  if (message) context.addIssue({ code: "custom", message });
});

const studentProfileFields = {
  displayName: displayNameSchema,
  nationalId: nationalIdSchema,
  school: schoolSchema,
  gradeId: gradeIdSchema,
  phone: phoneSchema,
};

const isoDateSchema = z.string().refine(isStrictIsoDate, "日期必须是有效的 YYYY-MM-DD");

export const publicRegistrationSchema = z
  .object({
    ...studentProfileFields,
    password: passwordSchema,
    confirmPassword: z.string(),
    truthAndPrivacyAccepted: z.literal(true, { error: "请确认信息真实性与隐私条款" }),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({ code: "custom", message: "两次输入的密码不一致", path: ["confirmPassword"] });
    }
  })
  .transform((input) => ({ ...input, username: input.displayName, gender: deriveGenderFromNationalId(input.nationalId)! }));

export const registrationProfileUpdateSchema = z
  .object(studentProfileFields)
  .strict()
  .transform((input) => ({ ...input, gender: deriveGenderFromNationalId(input.nationalId)! }));

export const approveRegistrationSchema = z
  .object({
    validFrom: isoDateSchema.optional(),
    validUntil: isoDateSchema.optional(),
    isLongTerm: z.boolean().optional(),
  })
  .strict()
  .superRefine(validateValidityInput);

export const rejectRegistrationSchema = z
  .object({ reason: z.string().trim().min(1, "拒绝原因不能为空").max(1000, "拒绝原因不能超过 1000 位") })
  .strict();

export const adminStudentUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    nationalId: nationalIdSchema.optional(),
    school: schoolSchema.optional(),
    gradeId: gradeIdSchema.optional(),
    phone: phoneSchema.optional(),
    enabled: z.boolean().optional(),
    validFrom: isoDateSchema.optional(),
    validUntil: isoDateSchema.optional(),
    isLongTerm: z.boolean().optional(),
  })
  .strict()
  .superRefine(validateValidityInput)
  .refine((input) => Object.keys(input).length > 0, "至少需要修改一个字段")
  .transform((input) => {
    if (!input.nationalId) return input;
    return { ...input, gender: deriveGenderFromNationalId(input.nationalId)! };
  });

export const gradeMutationSchema = z
  .object({
    code: z.string().trim().min(1, "年级代码不能为空").max(50, "年级代码不能超过 50 位"),
    name: z.string().trim().min(1, "年级名称不能为空").max(100, "年级名称不能超过 100 位"),
    sortOrder: z.number().int("排序必须是整数"),
    enabled: z.boolean(),
  })
  .strict();

const allowedReviewTransitions = new Set<string>([
  "PENDING->ACTIVE",
  "PENDING->REJECTED",
  "REJECTED->PENDING",
]);

export function assertReviewTransition(from: StudentStatus, to: StudentStatus) {
  if (!allowedReviewTransitions.has(`${from}->${to}`)) {
    throw new Error(`Invalid student review transition: ${from} -> ${to}`);
  }
}

export function buildDefaultValidity(reviewDate: string) {
  return {
    validFrom: reviewDate,
    validUntil: addCalendarYear(reviewDate),
  };
}

function validateValidityInput(
  input: { validFrom?: string; validUntil?: string; isLongTerm?: boolean },
  context: z.RefinementCtx,
) {
  if (input.isLongTerm) return;

  if ((input.validFrom === undefined) !== (input.validUntil === undefined)) {
    context.addIssue({
      code: "custom",
      message: "有效期开始和结束日期必须同时提供",
      path: [input.validFrom === undefined ? "validFrom" : "validUntil"],
    });
    return;
  }

  if (input.validFrom !== undefined && input.validUntil !== undefined && input.validFrom >= input.validUntil) {
    context.addIssue({ code: "custom", message: "有效期结束日期必须晚于开始日期", path: ["validUntil"] });
  }
}

function isStrictIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || match[1] === "0000") return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
