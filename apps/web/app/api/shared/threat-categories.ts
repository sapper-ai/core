export type ThreatCategory =
  | 'prompt_injection'
  | 'command_injection'
  | 'path_traversal'
  | 'data_exfiltration'
  | 'code_injection'
  | 'other'

const LABEL_TO_CATEGORY: Record<string, ThreatCategory> = {
  'ignore previous': 'prompt_injection',
  'ignore previous (ko)': 'prompt_injection',
  'system prompt': 'prompt_injection',
  'system prompt (ko)': 'prompt_injection',
  disregard: 'prompt_injection',
  'override instructions': 'prompt_injection',
  'override instructions (ko)': 'prompt_injection',
  'reveal your': 'prompt_injection',
  'reveal sensitive': 'prompt_injection',
  'output all': 'prompt_injection',
  'you are now': 'prompt_injection',
  jailbreak: 'prompt_injection',
  'jailbreak (ko)': 'prompt_injection',
  bypass: 'prompt_injection',
  'bypass (ko)': 'prompt_injection',
  'admin mode': 'prompt_injection',
  'security override': 'prompt_injection',
  'security override (ko)': 'prompt_injection',
  'urgent instruction prefix': 'prompt_injection',
  'bracketed user instruction': 'prompt_injection',
  'system override prefix': 'prompt_injection',
  'privileged mode': 'prompt_injection',
  'conversation history': 'prompt_injection',
  'system mode unrestricted': 'prompt_injection',
  'disable security filters': 'prompt_injection',
  'system role tag': 'prompt_injection',

  'rm rf root': 'command_injection',
  'command substitution': 'command_injection',
  'python os system': 'command_injection',
  'system function call': 'command_injection',
  'crlf injection': 'command_injection',

  'path traversal': 'path_traversal',
  'etc passwd shadow': 'path_traversal',
  'internal metadata ssrf': 'path_traversal',

  'api key exfiltration phrase': 'data_exfiltration',
  'admin password': 'data_exfiltration',
  'admin password (ko)': 'data_exfiltration',
  'secret exfiltration': 'data_exfiltration',
  'secret exfiltration (ko)': 'data_exfiltration',
  'admin base64': 'data_exfiltration',

  '<script>': 'code_injection',
  'template injection': 'code_injection',
  'xxe doctype': 'code_injection',
  'js url': 'code_injection',
  'prototype pollution': 'code_injection',
  'unicode bypass': 'code_injection',
  'sql tautology': 'code_injection',
  'sql drop table': 'code_injection',
  'quoted comment sqli': 'code_injection',
  'logic or one equals one': 'code_injection',
  'sql where quoted string': 'code_injection',
}

export function categorizeThreat(reason: string): ThreatCategory {
  const match = reason.match(/^Detected pattern: (.+)$/)
  if (!match) return 'other'
  return LABEL_TO_CATEGORY[match[1]] ?? 'other'
}

export const CATEGORY_LABELS: Record<ThreatCategory, string> = {
  prompt_injection: 'Prompt Injection',
  command_injection: 'Command Injection',
  path_traversal: 'Path Traversal',
  data_exfiltration: 'Data Exfiltration',
  code_injection: 'Code / SQL Injection',
  other: 'Other',
}
