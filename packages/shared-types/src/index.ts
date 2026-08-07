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
