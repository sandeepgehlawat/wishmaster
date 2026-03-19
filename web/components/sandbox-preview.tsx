"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, Maximize2, Download, Code, Eye, Loader2 } from "lucide-react";
import sdk from "@stackblitz/sdk";

interface SandboxPreviewProps {
  sandboxUrl?: string | null;
  sandboxProjectId?: string | null;
  jobId: string;
  jobTitle: string;
  isAgent?: boolean;
}

export default function SandboxPreview({
  sandboxUrl,
  sandboxProjectId,
  jobId,
  jobTitle,
  isAgent = false,
}: SandboxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"editor" | "preview">("editor");

  useEffect(() => {
    if (!sandboxProjectId || !containerRef.current) return;

    setIsLoading(true);
    setError(null);

    // Embed the StackBlitz project
    sdk
      .embedProjectId(containerRef.current, sandboxProjectId, {
        height: 500,
        openFile: "src/index.js",
        view: view === "preview" ? "preview" : "default",
        hideNavigation: true,
        hideExplorer: !isAgent,
        clickToLoad: false,
      })
      .then(() => {
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to embed StackBlitz:", err);
        setError("Failed to load sandbox");
        setIsLoading(false);
      });
  }, [sandboxProjectId, view, isAgent]);

  // If no sandbox exists yet, show placeholder
  if (!sandboxProjectId && !sandboxUrl) {
    return (
      <div className="border-2 border-white/30 p-8 text-center">
        <Code className="h-12 w-12 text-white/30 mx-auto mb-4" />
        <p className="text-white/50 text-sm mb-2">No workspace created yet</p>
        <p className="text-white/30 text-xs">
          A sandbox will be created when the agent starts working
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-white">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-green-400" />
          <span className="text-sm font-bold tracking-wider">WORKSPACE</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border border-white/30">
            <button
              onClick={() => setView("editor")}
              className={`px-3 py-1 text-xs ${
                view === "editor"
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Code className="h-3 w-3" />
            </button>
            <button
              onClick={() => setView("preview")}
              className={`px-3 py-1 text-xs border-l border-white/30 ${
                view === "preview"
                  ? "bg-white text-black"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>

          {/* Actions */}
          {sandboxUrl && (
            <>
              <a
                href={sandboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-white/50 hover:text-white"
                title="Open in StackBlitz"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                className="p-1 text-white/50 hover:text-white"
                title="Full Screen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sandbox Container */}
      <div className="relative bg-black" style={{ minHeight: 500 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/50 mx-auto mb-2" />
              <span className="text-sm text-white/50">Loading workspace...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center text-red-400">
              <p className="text-sm">{error}</p>
              {sandboxUrl && (
                <a
                  href={sandboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline mt-2 inline-block"
                >
                  Open in StackBlitz instead
                </a>
              )}
            </div>
          </div>
        )}

        <div ref={containerRef} className="w-full" style={{ height: 500 }} />
      </div>

      {/* Footer */}
      <div className="border-t border-white/30 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {isAgent ? "You have full edit access" : "Read-only view"}
        </span>
        <div className="flex items-center gap-4">
          {sandboxUrl && (
            <a
              href={sandboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              OPEN IN STACKBLITZ
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
