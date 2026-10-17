import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/server/env";

export class AiUnavailableError extends Error {
  constructor(detail: string) {
    super(`El servicio de IA no está disponible: ${detail}`);
  }
}

const structureResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  amount_mon: z.number().positive().nullable(),
  days: z.number().int().positive().nullable(),
  category: z.string().min(1).max(60).nullable(),
  keywords: z.array(z.string().max(60)).max(40),
  rules: z.array(z.object({ criterion: z.string().min(1).max(300), weight: z.number().int().min(1).max(5) })).min(1).max(12),
});

const reviewResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  results: z
    .array(
      z.object({
        position: z.number().int().min(1),
        met: z.boolean(),
        reasoning: z.string().min(1).max(1000),
        evidence_excerpt: z.string().max(500).nullable(),
      }),
    )
    .min(1)
    .max(12),
  model: z.string().min(1).max(100),
});

const screeningResponseSchema = z.object({
  verdict: z.enum(["accept", "review", "reject"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(1000),
  strengths: z.array(z.string().max(300)).max(6),
  concerns: z.array(z.string().max(300)).max(6),
  model: z.string().min(1).max(100),
});

export type AiRule = { criterion: string; weight: number };

export type StructureInput = {
  text?: string;
  file?: { fileName: string; mimeType: string; bytes: Uint8Array };
};

export type StructureOutput = {
  title: string;
  description: string;
  amountMon: number | null;
  days: number | null;
  category: string | null;
  keywords: string[];
  rules: AiRule[];
};

export type ReviewInput = {
  requirements: string;
  rules: { position: number; criterion: string; weight: number }[];
  providerNote: string;
  evidenceUrl: string;
};

export type ReviewOutput = {
  summary: string;
  results: { position: number; met: boolean; reasoning: string; evidenceExcerpt: string | null }[];
  model: string;
};

async function callAi<S extends z.ZodType>(path: string, body: unknown, schema: S, timeoutMs: number): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`${serverEnv.aiApiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serverEnv.aiApiSecret ? { "x-pact-ai-secret": serverEnv.aiApiSecret } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AiUnavailableError(error instanceof Error ? error.message : "sin respuesta");
  }
  if (!res.ok) throw new AiUnavailableError(`HTTP ${res.status}`);

  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) throw new AiUnavailableError("respuesta con formato inválido");
  return parsed.data;
}

export async function structureWithAi(input: StructureInput): Promise<StructureOutput> {
  const body = {
    text: input.text ?? null,
    file: input.file
      ? {
          file_name: input.file.fileName,
          mime_type: input.file.mimeType,
          data_base64: Buffer.from(input.file.bytes).toString("base64"),
        }
      : null,
  };
  const out = await callAi("/structure-agreement", body, structureResponseSchema, 45_000);
  return {
    title: out.title,
    description: out.description,
    amountMon: out.amount_mon,
    days: out.days,
    category: out.category,
    keywords: out.keywords,
    rules: out.rules,
  };
}

export async function reviewWithAi(input: ReviewInput): Promise<ReviewOutput> {
  const body = {
    requirements: input.requirements,
    rules: input.rules,
    provider_note: input.providerNote,
    evidence_url: input.evidenceUrl,
  };
  const out = await callAi("/review-evidence", body, reviewResponseSchema, 30_000);
  return {
    summary: out.summary,
    results: out.results.map((result) => ({
      position: result.position,
      met: result.met,
      reasoning: result.reasoning,
      evidenceExcerpt: result.evidence_excerpt,
    })),
    model: out.model,
  };
}

export type ScreeningInput = {
  listing: {
    title: string;
    description: string;
    category: string | null;
    keywords: string[];
    budgetMon: number | null;
    deadlineDays: number | null;
    rules: string[];
  };
  applicant: {
    displayName: string;
    bio: string;
    skills: string[];
    keywords: string[];
    availability: string | null;
    providerScore: number | null;
    completedJobs: number;
    portfolio: { title: string; description: string; url: string | null }[];
  };
  proposal: { message: string; priceMon: number | null; days: number | null };
  clientPreferences: string;
};

export type ScreeningOutput = {
  verdict: "accept" | "review" | "reject";
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  model: string;
};

export async function screenApplicantWithAi(input: ScreeningInput): Promise<ScreeningOutput> {
  const body = {
    listing: {
      title: input.listing.title,
      description: input.listing.description,
      category: input.listing.category,
      keywords: input.listing.keywords,
      budget_mon: input.listing.budgetMon,
      deadline_days: input.listing.deadlineDays,
      rules: input.listing.rules,
    },
    applicant: {
      display_name: input.applicant.displayName,
      bio: input.applicant.bio,
      skills: input.applicant.skills,
      keywords: input.applicant.keywords,
      availability: input.applicant.availability,
      provider_score: input.applicant.providerScore,
      completed_jobs: input.applicant.completedJobs,
      portfolio: input.applicant.portfolio,
    },
    proposal: { message: input.proposal.message, price_mon: input.proposal.priceMon, days: input.proposal.days },
    client_preferences: input.clientPreferences,
  };
  return callAi("/screen-applicant", body, screeningResponseSchema, 30_000);
}
