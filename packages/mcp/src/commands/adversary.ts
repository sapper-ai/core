import type { Policy } from '@sapper-ai/types'

import { AdversaryCampaignRunner } from '../services/AdversaryCampaignRunner'

interface AdversaryRunOptions {
  policy: Policy
  outDir: string
  agentConfigPath?: string
  maxCases?: number
  maxDurationMs?: number
  seed?: string
  write?: (text: string) => void
}

interface AdversaryReplayOptions {
  policy: Policy
  reproPath: string
  write?: (text: string) => void
}

function writeOutput(write: ((text: string) => void) | undefined, payload: unknown): void {
  const out = write ?? ((text: string) => process.stdout.write(text))
  out(`${JSON.stringify(payload, null, 2)}\n`)
}

export async function runAdversaryRunCommand(options: AdversaryRunOptions): Promise<void> {
  const runner = new AdversaryCampaignRunner()
  const result = await runner.run({
    policy: options.policy,
    outputDir: options.outDir,
    agentConfigPath: options.agentConfigPath,
    maxCases: options.maxCases,
    maxDurationMs: options.maxDurationMs,
    seed: options.seed,
  })

  writeOutput(options.write, {
    status: 'ok',
    ...result,
  })
}

export async function runAdversaryReplayCommand(options: AdversaryReplayOptions): Promise<void> {
  const runner = new AdversaryCampaignRunner()
  const result = await runner.replay({
    policy: options.policy,
    reproPath: options.reproPath,
  })

  writeOutput(options.write, {
    status: 'ok',
    ...result,
  })
}
