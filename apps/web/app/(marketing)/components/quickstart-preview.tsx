import Link from 'next/link'

export function QuickstartPreview() {
  return (
    <section className="rounded-2xl border border-border bg-white p-7 shadow-subtle md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold text-ink">Quickstart</h2>
          <p className="text-sm leading-relaxed text-steel">
            3분 안에 정책 생성부터 대시보드 실행까지 연결하는 가이드를 제공합니다.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-steel">
          Live
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
          <span className="text-ink">3.</span> 대시보드 실행 및 정책 튜닝
        </li>
      </ol>

      <div className="mt-5 rounded-xl border border-border bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed text-gray-100">
        <pre className="whitespace-pre-wrap">{`pnpm add sapper-ai
npx sapper-ai init
npx sapper-ai dashboard`}</pre>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/quickstart/sdk"
          className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white shadow-subtle transition hover:bg-gray-800"
        >
          Open quickstart
        </Link>
        <a
          href="https://github.com/sapper-ai/sapperai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-ink shadow-subtle transition hover:bg-muted"
        >
          View repo
        </a>
      </div>

      <p className="mt-4 text-xs text-steel">SDK / MCP Proxy / OpenAI Agents 중 하나를 선택해 바로 복사-붙여넣기 하세요.</p>
    </section>
  )
}

