"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, Maximize2, Code, Eye, Loader2, Lock, CheckCircle } from "lucide-react";
import sdk from "@stackblitz/sdk";

interface SandboxPreviewProps {
  sandboxUrl?: string | null;
  sandboxProjectId?: string | null;
  jobId: string;
  jobTitle: string;
  isAgent?: boolean;
  jobStatus?: string;
  height?: number;
}

// Default project template for new sandboxes
const getDefaultProject = (jobTitle: string, jobId: string) => ({
  title: `AgentHive - ${jobTitle}`,
  description: `Workspace for job ${jobId}`,
  template: "node" as const,
  files: {
    "index.js": `// AgentHive Workspace
// Job: ${jobTitle}
// ID: ${jobId}

console.log("Welcome to your AgentHive workspace!");
console.log("Start coding here...");

// Your code goes here
`,
    "README.md": `# ${jobTitle}

This is the workspace for your AgentHive job.

## Getting Started

Edit the files in this workspace to complete the job requirements.

## Job ID
\`${jobId}\`
`,
    "package.json": JSON.stringify({
      name: `agenthive-${jobId.slice(0, 8)}`,
      version: "1.0.0",
      description: jobTitle,
      main: "index.js",
      scripts: {
        start: "node index.js",
        dev: "node --watch index.js"
      }
    }, null, 2),
  },
});

export default function SandboxPreview({
  sandboxUrl,
  sandboxProjectId,
  jobId,
  jobTitle,
  isAgent = false,
  jobStatus = "assigned",
  height = 500,
}: SandboxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vmRef = useRef<any>(null);

  // Client can only see code after job is completed (payment released)
  const isCompleted = jobStatus === "completed";
  const canViewCode = isAgent || isCompleted;

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    setError(null);

    // Create a new project using embedProject (creates on-the-fly)
    const project = getDefaultProject(jobTitle, jobId);

    sdk
      .embedProject(containerRef.current, project, {
        height,
        openFile: canViewCode ? "index.js" : undefined,
        // Clients see preview only until job is completed
        view: canViewCode ? "default" : "preview",
        hideNavigation: true,
        // Hide file explorer for clients until completed
        hideExplorer: !canViewCode,
        clickToLoad: false,
      })
      .then((vm) => {
        vmRef.current = vm;
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("StackBlitz embed error:", err);
        setError("Failed to load sandbox");
        setIsLoading(false);
      });
  }, [jobId, jobTitle, canViewCode, height]);

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
          {canViewCode ? (
            <Code className="h-4 w-4 text-green-400" />
          ) : (
            <Eye className="h-4 w-4 text-yellow-400" />
          )}
          <span className="text-sm font-bold tracking-wider">
            {canViewCode ? "WORKSPACE" : "PREVIEW"}
          </span>
          {!canViewCode && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              CODE LOCKED
            </span>
          )}
          {isCompleted && !isAgent && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              UNLOCKED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Only show external link for agents or completed jobs */}
          {canViewCode && sandboxUrl && (
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
      <div className="relative bg-black" style={{ minHeight: height }}>
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
              {canViewCode && sandboxUrl && (
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

        <div ref={containerRef} className="w-full" style={{ height }} />
      </div>

      {/* Footer */}
      <div className="border-t border-white/30 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {isAgent
            ? "You have full edit access"
            : isCompleted
              ? "Full code access unlocked"
              : "Preview only - code unlocks after payment"}
        </span>
        <div className="flex items-center gap-4">
          {canViewCode && sandboxUrl && (
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
          {!canViewCode && (
            <span className="text-xs text-yellow-400/70 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Approve delivery to unlock code
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
