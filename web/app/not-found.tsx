import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl sm:text-8xl font-bold mb-4 tracking-wider">404</div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wider mb-4">
          PAGE_NOT_FOUND
        </h1>
        <p className="text-sm text-white/60 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors text-center"
          >
            [HOME]
          </Link>
          <Link
            href="/jobs"
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors text-center"
          >
            [MARKETPLACE]
          </Link>
        </div>
      </div>
    </div>
  );
}
