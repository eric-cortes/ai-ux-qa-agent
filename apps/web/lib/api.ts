export type RunStatus = 'queued' | 'running' | 'analyzing' | 'completed' | 'failed' | 'cancelled'
export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export type Run = {
  id: string
  project_id: string
  environment_id?: string | null
  target_url: string
  status: RunStatus
  created_at: string
  updated_at: string
  artifact_dir?: string | null
  error_message?: string | null
}

export type Finding = {
  id: string
  run_id: string
  category: 'ux' | 'accessibility' | 'functional' | 'network' | 'performance'
  title: string
  description: string
  severity: FindingSeverity
  confidence: number
  page_url: string
  observed_behavior: string
  reproduction_steps: string[]
  evidence_ids: string[]
  guideline_id?: string | null
  guideline_source_url?: string | null
  verification_status: 'confirmed' | 'likely' | 'needs_human_review'
  status: 'open' | 'accepted' | 'rejected' | 'fixed'
}

export type Evidence = {
  title?: string
  targetUrl?: string
  finalUrl?: string
  actions?: string[]
  consoleMessages?: string[]
  failedRequests?: string[]
  errorResponses?: Array<{ url: string; status: number; method: string }>
  interactiveElements?: Array<{
    tag: string
    text?: string
    ariaLabel?: string | null
    name?: string | null
    type?: string | null
  }>
  axeViolations?: Array<{
    id: string
    impact?: string | null
    description?: string
    help?: string
  }>
  guidelineChecks?: {
    unlabeledFormControls?: unknown[]
    smallTargets?: unknown[]
    viewport?: { hasHorizontalOverflow?: boolean }
    keyboard?: { sampledTabStops?: string[] }
  }
}

export type FormState = {
  projectId: string
  environmentId: string
  targetUrl: string
  loginEmail: string
  loginPassword: string
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api'
export const artifactOrigin = apiBaseUrl.replace(/\/api\/?$/, '')

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super('API request failed')
  }
}

async function request<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { cache: 'no-store', ...init, signal })
    if (!response.ok) throw new ApiError(response.status)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (
      signal?.aborted ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError') ||
      error instanceof ApiError
    )
      throw error
    // Network and JSON parsing errors may contain sensitive response details.
    throw new ApiError(0)
  }
}

export function listRuns(signal?: AbortSignal) {
  return request<Run[]>('/runs', signal)
}

export async function getRunBundle(id: string, signal?: AbortSignal) {
  const path = `/runs/${encodeURIComponent(id)}`
  const [run, findings, evidence] = await Promise.all([
    request<Run>(path, signal),
    request<Finding[]>(`${path}/findings`, signal).catch(error => {
      if (!signal?.aborted && error instanceof ApiError && error.status === 404) return []
      throw error
    }),
    request<Evidence>(`${path}/evidence`, signal).catch(error => {
      if (!signal?.aborted && error instanceof ApiError && error.status === 404) return null
      throw error
    }),
  ])
  return { run, findings, evidence }
}

export function createRun(form: FormState, signal?: AbortSignal) {
  return request<Run>('/runs', signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: form.projectId,
      environment_id: form.environmentId || undefined,
      target_url: form.targetUrl,
      login_email: form.loginEmail || undefined,
      login_password: form.loginPassword || undefined,
    }),
  })
}

export async function clearRuns(signal?: AbortSignal) {
  try {
    const response = await fetch(`${apiBaseUrl}/runs`, { method: 'DELETE', signal })
    if (!response.ok) throw new ApiError(response.status)
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error
    throw new ApiError(0)
  }
}
