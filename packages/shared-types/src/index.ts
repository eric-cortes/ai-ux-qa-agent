import { z } from "zod";

export const qaRunStatusSchema = z.enum([
  "queued",
  "running",
  "analyzing",
  "completed",
  "failed",
  "cancelled"
]);

export const createRunSchema = z.object({
  projectId: z.string().min(1),
  environmentId: z.string().min(1).optional(),
  targetUrl: z.string().url(),
  loginEmail: z.string().email().optional(),
  loginPassword: z.string().min(1).optional()
});

export const verificationStatusSchema = z.enum(["confirmed", "likely", "needs_human_review"]);

export const findingSchema = z.object({
  id: z.string(),
  runId: z.string(),
  category: z.enum(["ux", "accessibility", "functional", "network", "performance"]),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  pageUrl: z.string().url(),
  observedBehavior: z.string(),
  reproductionSteps: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  guidelineId: z.string().nullable().optional(),
  guidelineSourceUrl: z.string().url().nullable().optional(),
  verificationStatus: verificationStatusSchema,
  status: z.enum(["open", "accepted", "rejected", "fixed"])
});

export const qaRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environmentId: z.string().nullable().optional(),
  targetUrl: z.string().url(),
  status: qaRunStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  artifactDir: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable()
});

export type CreateRunInput = z.infer<typeof createRunSchema>;
export type QARun = z.infer<typeof qaRunSchema>;
export type Finding = z.infer<typeof findingSchema>;
