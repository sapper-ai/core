---
"sapper-ai": minor
---

Add interactive scan UX, AI deep scan, and HTML report

- Arrow-key scan scope selection with @inquirer/select
- --ai flag for 2-pass scan (rules + LLM via OpenAI gpt-4.1-mini)
- --report flag for self-contained HTML report with dark/light theme, file tree, risk chart
- Auto-save scan results as JSON to ~/.sapperai/scans/
- --no-save flag to skip result persistence
- Fix XSS in HTML report and command injection in browser open
