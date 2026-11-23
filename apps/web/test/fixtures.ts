import type { Run, Finding, Evidence } from '@/lib/api'

export const run: Run = {
  id: 'run-one',
  project_id: 'demo',
  environment_id: 'local',
  target_url: 'https://example.com',
  status: 'completed',
  created_at: '2026-01-01T12:00:00Z',
  updated_at: '2026-01-01T12:00:00Z',
}
export const secondRun: Run = { ...run, id: 'run-two', project_id: 'second' }
export const finding: Finding = {
  id: 'finding-one',
  run_id: run.id,
  category: 'accessibility',
  title: 'Missing label',
  description: 'The input has no label.',
  severity: 'high',
  confidence: 0.9,
  page_url: run.target_url,
  observed_behavior: 'No accessible name',
  reproduction_steps: ['Open the page', 'Focus the input'],
  evidence_ids: [],
  guideline_id: 'WCAG 3.3.2',
  guideline_source_url: 'https://www.w3.org/WAI/',
  verification_status: 'needs_human_review',
  status: 'open',
}
export const evidence: Evidence = {
  title: 'Example page',
  finalUrl: 'https://example.com',
  actions: ['Navigate'],
  consoleMessages: ['Browser log'],
  failedRequests: [],
  errorResponses: [],
  guidelineChecks: {
    unlabeledFormControls: [{}],
    smallTargets: [],
    viewport: { hasHorizontalOverflow: false },
    keyboard: { sampledTabStops: ['input'] },
  },
}
