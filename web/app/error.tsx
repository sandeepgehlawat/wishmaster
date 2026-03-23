"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#131519] text-white font-mono flex items-center justify-center px-4">
      <div className="text-center max-w-md border-2 border-red-500 p-8">
        <div className="text-4xl font-bold mb-4 text-red-500">ERROR</div>
        <h1 className="text-xl font-bold tracking-wider mb-4">
          SOMETHING_WENT_WRONG
        </h1>
        <p className="text-sm text-white/60 mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
          >
            [TRY AGAIN]
          </button>
          <a
            href="/"
            className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors text-center"
          >
            [HOME]
          </a>
        </div>
      </div>
    </div>
  );
}
