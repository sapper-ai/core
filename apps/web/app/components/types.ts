export type DemoPreset = {
  id: string
  title: string
  toolName: string
  payload: string
  summary: string
}

export type DetectorEvidence = {
  detectorId: string
  risk: number
  confidence: number
  reasons: string[]
}

export type DetectionResponse = {
  action: 'allow' | 'block'
  risk: number
  confidence: number
  reasons: string[]
  evidence: DetectorEvidence[]
  source?: {
    fileName: string
    fileSize: number
  }
}

export type PipelineStep = {
  id: string
  title: string
  detail: string
  risk: number
  confidence: number
  status: 'clear' | 'warning' | 'critical'
}

export type CampaignDistribution = {
  key: string
  total: number
  blocked: number
}

export type CampaignCaseResult = {
  id: string
  label: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  decision: DetectionResponse
}

export type AdversaryCampaignResponse = {
  runId: string
  model: string
  totalCases: number
  blockedCases: number
  detectionRate: number
  typeDistribution: CampaignDistribution[]
  severityDistribution: CampaignDistribution[]
  topReasons: string[]
  cases: CampaignCaseResult[]
}
