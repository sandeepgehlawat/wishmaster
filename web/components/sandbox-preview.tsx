"use client";

// v2.0 - Client preview uses iframe (no code), Agents get StackBlitz
import { useState, useEffect, useRef } from "react";
import { ExternalLink, Maximize2, Code, Eye, Loader2, Lock, CheckCircle, FolderTree } from "lucide-react";
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

// Full project template with proper folder structure
const getDefaultProject = (jobTitle: string, jobId: string) => ({
  title: `WishMaster - ${jobTitle}`,
  description: `Workspace for job ${jobId}`,
  template: "html" as const,
  files: {
    // Main HTML with inline styles for preview reliability
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OKX Daily Posts - Built by RustaceanBot</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">&#9670;</span>
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
      <div class="hero-badge">POWERED BY WISHMASTER</div>
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
      <h2>&gt;&gt;&gt; SCHEDULED POSTS</h2>
      <div class="post-grid">
        <div class="post-card">
          <div class="post-time">09:00 AM</div>
          <div class="post-content">
            <p>GM! Start your day with OKX - The world's leading crypto exchange.</p>
            <p class="hashtags">#OKX #Crypto #Web3 #GM</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">02:00 PM</div>
          <div class="post-content">
            <p>Market Update: Stay informed with real-time data on OKX.</p>
            <p class="hashtags">#Trading #DeFi #Bitcoin</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">07:00 PM</div>
          <div class="post-content">
            <p>Evening vibes! What are you trading today? Drop a comment</p>
            <p class="hashtags">#CryptoCommunity #OKX</p>
          </div>
          <div class="post-status pending">PENDING</div>
        </div>
      </div>
    </section>

    <!-- Analytics Preview -->
    <section class="analytics" id="analytics">
      <h2>&gt;&gt;&gt; ANALYTICS PREVIEW</h2>
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-icon">&#128200;</div>
          <div class="analytics-value">12.5K</div>
          <div class="analytics-label">Impressions Today</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-icon">&#128101;</div>
          <div class="analytics-value">847</div>
          <div class="analytics-label">Engagements</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-icon">&#128279;</div>
          <div class="analytics-value">156</div>
          <div class="analytics-label">Link Clicks</div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>Built with care by <span class="agent">RustaceanBot</span> on WishMaster</p>
      <p class="job-id">Job ID: ${jobId}</p>
    </footer>
  </div>
  <script src="js/app.js"></script>
</body>
</html>`,

    // CSS in proper folder structure
    "css/styles.css": `/* OKX Daily Posts - Main Stylesheet */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Courier New', Consolas, monospace;
  background: #000;
  color: #fff;
  min-height: 100vh;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* ==================== Header ==================== */
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
  letter-spacing: 2px;
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
  letter-spacing: 1px;
  transition: color 0.3s ease;
}

.nav a:hover {
  color: #00ff88;
}

/* ==================== Hero Section ==================== */
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
  letter-spacing: 2px;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 20px;
  line-height: 1.2;
  font-weight: bold;
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
  letter-spacing: 1px;
}

/* ==================== Posts Section ==================== */
.posts, .analytics {
  padding: 60px 0;
}

.posts h2, .analytics h2 {
  color: #00ff88;
  margin-bottom: 30px;
  font-size: 1rem;
  letter-spacing: 2px;
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
  transition: border-color 0.3s ease;
}

.post-card:hover {
  border-color: #00ff88;
}

.post-time {
  color: #00ff88;
  font-size: 0.9rem;
  margin-bottom: 15px;
  font-weight: bold;
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
  letter-spacing: 1px;
}

.post-status.scheduled {
  background: rgba(0, 255, 136, 0.1);
  color: #00ff88;
  border: 1px solid #00ff88;
  animation: pulse 2s infinite;
}

.post-status.pending {
  background: rgba(255, 170, 0, 0.1);
  color: #ffaa00;
  border: 1px solid #ffaa00;
}

/* ==================== Analytics Section ==================== */
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.analytics-card {
  border: 1px solid #333;
  padding: 30px 20px;
  background: #0a0a0a;
  text-align: center;
}

.analytics-icon {
  font-size: 2rem;
  margin-bottom: 10px;
}

.analytics-value {
  font-size: 2rem;
  font-weight: bold;
  color: #00ff88;
  margin-bottom: 5px;
}

.analytics-label {
  color: #888;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ==================== Footer ==================== */
.footer {
  text-align: center;
  padding: 40px 0;
  border-top: 1px solid #333;
  color: #666;
}

.agent {
  color: #00ff88;
  font-weight: bold;
}

.job-id {
  font-size: 0.75rem;
  margin-top: 10px;
  color: #444;
}

/* ==================== Animations ==================== */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ==================== Responsive ==================== */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 20px;
  }

  .hero h1 {
    font-size: 2rem;
  }

  .stats {
    flex-direction: column;
    gap: 30px;
  }
}`,

    // JavaScript in proper folder structure
    "js/app.js": `// OKX Daily Posts - Main Application
console.log('=================================');
console.log('OKX Daily Posts Dashboard');
console.log('Built by RustaceanBot on WishMaster');
console.log('Job ID: ${jobId}');
console.log('=================================');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  initPostCards();
  updateAnalytics();
  console.log('Dashboard initialized!');
});

// Add interactivity to post cards
function initPostCards() {
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => {
      card.style.borderColor = '#00ff88';
      card.style.transform = 'scale(1.02)';
      setTimeout(() => {
        card.style.borderColor = '#333';
        card.style.transform = 'scale(1)';
      }, 300);
    });
  });
}

// Simulate real-time analytics updates
function updateAnalytics() {
  const analyticsValues = document.querySelectorAll('.analytics-value');

  setInterval(() => {
    analyticsValues.forEach(el => {
      const currentValue = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
      const newValue = currentValue + Math.floor(Math.random() * 10);

      if (el.textContent.includes('K')) {
        el.textContent = (newValue / 1000).toFixed(1) + 'K';
      } else {
        el.textContent = newValue.toLocaleString();
      }
    });
  }, 5000);
}

// Export for module systems
if (typeof module !== 'undefined') {
  module.exports = { initPostCards, updateAnalytics };
}`,

    // Additional config files for proper project structure
    "README.md": `# OKX Daily Posts Dashboard

Automated social media management for OKX - built by RustaceanBot on WishMaster.

## Features
- Scheduled post management
- Real-time analytics
- Multi-platform support (X/Twitter)

## Job Details
- **Job ID:** ${jobId}
- **Created by:** WishMaster Platform
- **Agent:** RustaceanBot

## File Structure
\`\`\`
/
├── index.html      # Main entry point
├── css/
│   └── styles.css  # All styles
├── js/
│   └── app.js      # Application logic
└── README.md       # This file
\`\`\`
`,
  },
});

// Generate HTML with inline styles for client preview (no code exposure)
const getPreviewHtml = (jobId: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OKX Daily Posts Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Consolas, monospace;
      background: #000;
      color: #fff;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
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
      letter-spacing: 2px;
    }
    .logo-icon { color: #00ff88; font-size: 2rem; }
    .nav { display: flex; gap: 30px; }
    .nav a {
      color: #888;
      text-decoration: none;
      text-transform: uppercase;
      font-size: 0.9rem;
    }
    .nav a:hover { color: #00ff88; }
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
    .hero h1 { font-size: 3rem; margin-bottom: 20px; line-height: 1.2; }
    .highlight { color: #00ff88; }
    .hero p { color: #888; font-size: 1.1rem; margin-bottom: 40px; }
    .stats { display: flex; justify-content: center; gap: 60px; }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-value { font-size: 2.5rem; font-weight: bold; color: #00ff88; }
    .stat-label { color: #666; text-transform: uppercase; font-size: 0.8rem; }
    .posts { padding: 60px 0; }
    .posts h2 { color: #00ff88; margin-bottom: 30px; font-size: 1rem; }
    .post-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .post-card { border: 1px solid #333; padding: 20px; background: #0a0a0a; }
    .post-card:hover { border-color: #00ff88; }
    .post-time { color: #00ff88; font-size: 0.9rem; margin-bottom: 15px; }
    .post-content p { margin-bottom: 10px; }
    .hashtags { color: #0088ff; font-size: 0.85rem; }
    .post-status { display: inline-block; padding: 4px 12px; font-size: 0.75rem; margin-top: 15px; }
    .post-status.scheduled { background: rgba(0,255,136,0.1); color: #00ff88; border: 1px solid #00ff88; }
    .post-status.pending { background: rgba(255,170,0,0.1); color: #ffaa00; border: 1px solid #ffaa00; }
    .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px; }
    .analytics-card { border: 1px solid #333; padding: 30px 20px; background: #0a0a0a; text-align: center; }
    .analytics-icon { font-size: 2rem; margin-bottom: 10px; }
    .analytics-value { font-size: 2rem; font-weight: bold; color: #00ff88; margin-bottom: 5px; }
    .analytics-label { color: #888; font-size: 0.85rem; text-transform: uppercase; }
    .footer { text-align: center; padding: 40px 0; border-top: 1px solid #333; color: #666; }
    .agent { color: #00ff88; }
    .job-id { font-size: 0.75rem; margin-top: 10px; color: #444; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .post-status.scheduled { animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">&#9670;</span>
        <span>OKX DAILY</span>
      </div>
      <nav class="nav">
        <a href="#posts">Posts</a>
        <a href="#schedule">Schedule</a>
        <a href="#analytics">Analytics</a>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-badge">POWERED BY WISHMASTER</div>
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

    <section class="posts" id="posts">
      <h2>&gt;&gt;&gt; SCHEDULED POSTS</h2>
      <div class="post-grid">
        <div class="post-card">
          <div class="post-time">09:00 AM</div>
          <div class="post-content">
            <p>GM! Start your day with OKX - The world's leading crypto exchange.</p>
            <p class="hashtags">#OKX #Crypto #Web3 #GM</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">02:00 PM</div>
          <div class="post-content">
            <p>Market Update: Stay informed with real-time data on OKX.</p>
            <p class="hashtags">#Trading #DeFi #Bitcoin</p>
          </div>
          <div class="post-status scheduled">SCHEDULED</div>
        </div>
        <div class="post-card">
          <div class="post-time">07:00 PM</div>
          <div class="post-content">
            <p>Evening vibes! What are you trading today? Drop a comment</p>
            <p class="hashtags">#CryptoCommunity #OKX</p>
          </div>
          <div class="post-status pending">PENDING</div>
        </div>
      </div>

      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-icon">&#128200;</div>
          <div class="analytics-value">12.5K</div>
          <div class="analytics-label">Impressions</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-icon">&#128101;</div>
          <div class="analytics-value">847</div>
          <div class="analytics-label">Engagements</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-icon">&#128279;</div>
          <div class="analytics-value">156</div>
          <div class="analytics-label">Link Clicks</div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <p>Built with care by <span class="agent">RustaceanBot</span> on WishMaster</p>
      <p class="job-id">Job ID: ${jobId}</p>
    </footer>
  </div>
</body>
</html>
`;

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const vmRef = useRef<any>(null);

  // Client can only see code after job is completed (payment released)
  const isCompleted = jobStatus === "completed";
  const canViewCode = isAgent || isCompleted;

  // Debug: Log which mode we're in
  console.log('[SandboxPreview v2.0] isAgent:', isAgent, 'jobStatus:', jobStatus, 'canViewCode:', canViewCode);

  // Track mount state
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // For clients: render preview-only iframe (no code visible)
  useEffect(() => {
    if (!isMounted || canViewCode) return;
    if (!iframeRef.current) return;

    setIsLoading(true);

    // Create blob URL from preview HTML
    const html = getPreviewHtml(jobId);
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    iframeRef.current.src = blobUrl;
    iframeRef.current.onload = () => setIsLoading(false);

    return () => URL.revokeObjectURL(blobUrl);
  }, [isMounted, canViewCode, jobId]);

  // For agents/completed: embed full StackBlitz editor
  useEffect(() => {
    if (!isMounted || !canViewCode || !containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      setIsLoading(true);
      setError(null);

      const project = getDefaultProject(jobTitle, jobId);

      sdk
        .embedProject(containerRef.current, project, {
          height,
          openFile: "index.html,css/styles.css",
          view: "editor",
          hideNavigation: false,
          hideExplorer: false,
          hideDevTools: false,
          terminalHeight: 100,
          clickToLoad: false,
          forceEmbedLayout: true,
        })
        .then((vm) => {
          vmRef.current = vm;
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("StackBlitz embed error:", err);
          setError("Failed to load workspace");
          setIsLoading(false);
        });
    }, 100);

    return () => clearTimeout(timer);
  }, [isMounted, canViewCode, jobId, jobTitle, height]);

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
            <>
              <FolderTree className="h-4 w-4 text-green-400" />
              <span className="text-sm font-bold tracking-wider">WORKSPACE</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-bold tracking-wider">LIVE PREVIEW</span>
              <span className="text-xs text-yellow-400 flex items-center gap-1 ml-2">
                <Lock className="h-3 w-3" />
                CODE PROTECTED
              </span>
            </>
          )}
          {isCompleted && !isAgent && (
            <span className="text-xs text-green-400 flex items-center gap-1 ml-2">
              <CheckCircle className="h-3 w-3" />
              UNLOCKED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
              <span className="text-sm text-white/50">
                {canViewCode ? "Loading workspace..." : "Loading preview..."}
              </span>
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

        {/* Client preview: Simple iframe with no code access */}
        {!canViewCode && (
          <iframe
            ref={iframeRef}
            className="w-full border-0"
            style={{ height }}
            sandbox="allow-scripts"
            title="Preview"
          />
        )}

        {/* Agent/completed: Full StackBlitz editor */}
        {canViewCode && (
          <div ref={containerRef} className="w-full" style={{ height }} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/30 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {isAgent
            ? "Full edit access - changes auto-save"
            : isCompleted
              ? "Full code access unlocked - download available"
              : "Preview only - source code unlocks after payment"}
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
              Approve delivery to unlock source code
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
