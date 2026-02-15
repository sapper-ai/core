import type { Metadata } from 'next'

import { UploadSection } from '../_components/demos/upload-section'

export const metadata: Metadata = {
  title: 'Playground: Skill Scan',
  alternates: { canonical: '/playground/skill-scan' },
}

export default function PlaygroundSkillScanPage() {
  return <UploadSection />
}

