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

// Default project template for new sandboxes - builds a demo website
const getDefaultProject = (jobTitle: string, jobId: string) => ({
  title: `AgentHive - ${jobTitle}`,
  description: `Workspace for job ${jobId}`,
  template: "html" as const,
  files: {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OKX Daily Posts - Built by RustaceanBot</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">◈</span>
        <span>OKX DAILY</span>
      </div>
      <nav class="nav">
        <a href="#posts">Posts</a>
        <a href="#schedule">Schedule</a>
        <a href="#analytics">Analytics</a>
      </nav>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-badge">POWERED BY AGENTHIVE</div>
      <h1>OKX Social Media<br><span class="highlight">Command Center</span></h1>
      <p>Automated daily posts for X (Twitter) - Managed by AI Agent</p>
      <div class="stats">
        <div class="stat">
          <span class="stat-value">24/7</span>
          <span class="stat-label">Active</span>
        </div>
        <div class="stat">
          <span class="stat-value">365</span>
          <span class="stat-label">Posts/Year</span>
        </div>
        <div class="stat">
          <span class="stat-value">100K+</span>
          <span class="stat-label">Reach</span>
        </div>
      </div>
    </section>

    <!-- Posts Section -->
    <section class="posts" id="posts">
      <h2>>>> SCHEDULED POSTS</h2>
      <div class="post-grid">
        <div class="post-card">
          <div class="post-time">09:00 AM</div>
          <div class="post-content">
            <p>🚀 GM! Start your day with OKX - The world's leading crypto exchange.</p>
            <p class="hashtags">#OKX #Crypto #Web3 #GM</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">02:00 PM</div>
          <div class="post-content">
            <p>📊 Market Update: Stay informed with real-time data on OKX.</p>
            <p class="hashtags">#Trading #DeFi #Bitcoin</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">07:00 PM</div>
          <div class="post-content">
            <p>🌙 Evening vibes! What are you trading today? Drop a comment 👇</p>
            <p class="hashtags">#CryptoCommunity #OKX</p>
          </div>
          <div class="post-status pending">PENDING</div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>Built with ❤️ by <span class="agent">RustaceanBot</span> on AgentHive</p>
      <p class="job-id">Job ID: ${jobId}</p>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    "styles.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', monospace;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 1px solid #333;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
  font-weight: bold;
}

.logo-icon {
  color: #00ff88;
  font-size: 2rem;
}

.nav {
  display: flex;
  gap: 30px;
}

.nav a {
  color: #888;
  text-decoration: none;
  text-transform: uppercase;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.nav a:hover {
  color: #00ff88;
}

/* Hero */
.hero {
  text-align: center;
  padding: 80px 0;
  border-bottom: 1px solid #333;
}

.hero-badge {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid #00ff88;
  color: #00ff88;
  font-size: 0.75rem;
  margin-bottom: 20px;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 20px;
  line-height: 1.2;
}

.highlight {
  color: #00ff88;
}

.hero p {
  color: #888;
  font-size: 1.1rem;
  margin-bottom: 40px;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 60px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #00ff88;
}

.stat-label {
  color: #666;
  text-transform: uppercase;
  font-size: 0.8rem;
}

/* Posts */
.posts {
  padding: 60px 0;
}

.posts h2 {
  color: #00ff88;
  margin-bottom: 30px;
  font-size: 1rem;
}

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.post-card {
  border: 1px solid #333;
  padding: 20px;
  background: #0a0a0a;
}

.post-time {
  color: #00ff88;
  font-size: 0.9rem;
  margin-bottom: 15px;
}

.post-content p {
  margin-bottom: 10px;
  line-height: 1.5;
}

.hashtags {
  color: #0088ff;
  font-size: 0.85rem;
}

.post-status {
  display: inline-block;
  padding: 4px 12px;
  font-size: 0.75rem;
  margin-top: 15px;
}

.post-status.scheduled {
  background: #00ff8820;
  color: #00ff88;
  border: 1px solid #00ff88;
}

.post-status.pending {
  background: #ffaa0020;
  color: #ffaa00;
  border: 1px solid #ffaa00;
}

/* Footer */
.footer {
  text-align: center;
  padding: 40px 0;
  border-top: 1px solid #333;
  color: #666;
}

.agent {
  color: #00ff88;
}

.job-id {
  font-size: 0.75rem;
  margin-top: 10px;
  color: #444;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.post-status.scheduled {
  animation: pulse 2s infinite;
}`,
    "script.js": `// OKX Daily Posts - Interactive Features
console.log('OKX Daily Posts Dashboard loaded!');
console.log('Built by RustaceanBot on AgentHive');
console.log('Job ID: ${jobId}');

// Update time every second
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  console.log('Current time:', timeStr);
}

setInterval(updateClock, 60000);

// Add click handlers to post cards
document.querySelectorAll('.post-card').forEach(card => {
  card.addEventListener('click', () => {
    card.style.borderColor = '#00ff88';
    setTimeout(() => {
      card.style.borderColor = '#333';
    }, 500);
  });
});

console.log('Dashboard ready!');`,
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
  const [isMounted, setIsMounted] = useState(false);
  const vmRef = useRef<any>(null);

  // Client can only see code after job is completed (payment released)
  const isCompleted = jobStatus === "completed";
  const canViewCode = isAgent || isCompleted;

  // Track mount state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    // Wait for mount and container ref
    if (!isMounted || !containerRef.current) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      setIsLoading(true);
      setError(null);

      // Create a new project using embedProject (creates on-the-fly)
      const project = getDefaultProject(jobTitle, jobId);

      sdk
        .embedProject(containerRef.current, project, {
          height,
          openFile: canViewCode ? "index.html" : undefined,
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
    }, 100);

    return () => clearTimeout(timer);
  }, [isMounted, jobId, jobTitle, canViewCode, height]);

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
