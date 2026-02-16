import Link from 'next/link'

export function QuickstartPreview() {
  return (
    <section className="rounded-lg border border-border bg-surface p-7 md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <h2 className="font-heading text-lg font-semibold text-ink">Quickstart</h2>
          <p className="text-sm leading-relaxed text-steel">
            3단계로 설치, 정책 초기화, 입력 스캔 실행까지 바로 연결할 수 있습니다.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-mono font-semibold text-steel">
          3 steps
        </span>
      </div>

      <ol className="mt-5 grid gap-2 text-sm text-steel">
        <li className="flex gap-2">
          <span className="text-ink">1.</span> 패키지 설치
        </li>
        <li className="flex gap-2">
          <span className="text-ink">2.</span> `sapper-ai init`로 설정 생성
        </li>
        <li className="flex gap-2">
          <span className="text-ink">3.</span> `sapper-ai scan`으로 입력 검사
        </li>
      </ol>

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-steel/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-steel/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-steel/30" />
          </div>
          <p className="font-mono text-xs text-steel">terminal</p>
        </div>
        <div className="bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed text-gray-100">
          <pre className="whitespace-pre-wrap">{`$ pnpm add sapper-ai
$ npx sapper-ai init
$ npx sapper-ai scan`}</pre>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/quickstart/sdk"
          className="inline-flex items-center justify-center rounded-lg bg-olive-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-olive-700 dark:bg-olive-400 dark:text-ink dark:hover:bg-olive-300"
        >
          Open quickstart
        </Link>
        <a
          href="https://github.com/sapper-ai/sapperai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink transition hover:bg-muted"
        >
          View repo
        </a>
      </div>

      <p className="mt-4 text-xs text-steel">SDK / MCP Proxy / OpenAI Agents 중 하나를 선택해 바로 복사-붙여넣기 하세요.</p>
    </section>
  )
}
