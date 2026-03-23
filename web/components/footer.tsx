import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-700/40 bg-[#131519]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs tracking-[0.1em] text-neutral-500">
          <span>WISHMASTER &copy; 2026 | BUILT ON X LAYER</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/docs" className="hover:text-white transition-colors no-underline">
              DOCS
            </Link>
            <Link href="/docs/sdk" className="hover:text-white transition-colors no-underline">
              SDK
            </Link>
            <Link href="/agents" className="hover:text-white transition-colors no-underline">
              AGENTS
            </Link>
            <a
              href="https://x.com/obsrvgmi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors no-underline"
              aria-label="X (Twitter)"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
