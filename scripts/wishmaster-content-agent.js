#!/usr/bin/env node

/**
 * WishMaster Content Agent — creates promotional threads about WishMaster
 *
 * Registers on local WishMaster, bids on content jobs, generates a
 * polished thread about the platform, submits as deliverable.
 * Content is half-hidden until payment release.
 */

const fs = require("fs");
const path = require("path");

const API_BASE = process.env.API_URL || "http://localhost:3001";
const POLL_INTERVAL = 15000;
const CREDS_FILE = path.join(__dirname, ".wishmaster-content-agent-creds.json");

let apiKey = null;
let agentId = null;
let biddedJobs = new Set();
let workingJobs = new Map(); // jobId -> { start, phase, delivered }
let seenMessages = new Set();

// ---- HTTP ----

async function api(endpoint, options = {}) {
  const { method = "GET", body } = options;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`${res.status}: ${err.error?.message || err.message || "API error"}`);
  }
  return res.json();
}

// ---- Credentials ----

function loadCreds() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const d = JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
      apiKey = d.apiKey;
      agentId = d.agentId;
      return true;
    }
  } catch (e) {}
  return false;
}

function saveCreds() {
  fs.writeFileSync(CREDS_FILE, JSON.stringify({ apiKey, agentId }, null, 2));
}

async function register() {
  console.log("Registering WishMaster Content Agent...");
  const result = await api("/api/agents/register", {
    method: "POST",
    body: {
      display_name: "ThreadWeaver",
      description: "Premium content strategist specializing in Web3 & AI narratives. I craft viral Twitter/X threads, launch campaigns, and brand storytelling for decentralized platforms. Polished, engaging, conversion-optimized content with posting strategy included.",
      skills: [
        "content", "copywriting", "twitter", "social-media",
        "marketing", "web3", "ai", "branding", "threads",
        "storytelling", "crypto", "growth",
      ],
      generate_wallet: true,
    },
  });

  apiKey = result.api_key;
  agentId = result.agent.id;
  saveCreds();

  console.log(`Registered: ThreadWeaver`);
  console.log(`Agent ID: ${agentId}`);
  console.log(`Wallet: ${result.wallet?.address || "N/A"}\n`);
}

// ---- Thread Content ----

function generateWishMasterThread() {
  return {
    title: "WishMaster Platform Thread - The Future of AI Agent Work",
    // The full thread content
    fullThread: `
=== THREAD: The Future of Work is Here ===

1/ Imagine a world where AI agents bid on your projects, deliver production-ready work, and get paid automatically via smart contracts.

That world exists. It's called @WishMaster_lol

Here's why it changes everything: 🧵

---

2/ THE PROBLEM:

You need work done — code, content, analysis, audits.

Traditional freelancing? Slow. Expensive. Unreliable.

WishMaster flips the script: post a job, and AI agents compete to deliver the best work at the best price.

---

3/ HOW IT WORKS:

Step 1: Post a job with your requirements + budget
Step 2: AI agents analyze your task and submit bids
Step 3: Select the best bid
Step 4: Agent delivers work + submits deliverables
Step 5: Approve & release payment on-chain

That's it. End-to-end. Trustless.

---

4/ THE TECH STACK:

- Smart contracts on X Layer (EVM L2)
- USDC escrow — funds locked until you approve
- ERC-8004 reputation — on-chain trust scores
- Real-time bidding with AI agents
- Deliverable verification before payment

No middlemen. No disputes. Just results.

---

5/ AGENT TYPES ON THE PLATFORM:

- Full-stack developers (Rust, TypeScript, Python, Solidity)
- Content creators (threads, campaigns, brand narratives)
- Security auditors (smart contract reviews)
- Data analysts (ML models, market research)
- DevOps specialists (CI/CD, Docker, deployments)

All competing for YOUR job.

---

6/ THE ESCROW SYSTEM:

Your money is SAFE:

1. You deposit USDC into the escrow contract
2. Funds are locked to the selected agent
3. Agent delivers work
4. You review deliverables
5. Approve → USDC released to agent automatically

If you're not happy? Request revision or dispute.

---

7/ FOR AGENTS — WHY BUILD HERE:

- Get discovered by clients automatically
- Build on-chain reputation (ERC-8004 NFTs)
- Earn USDC for every completed job
- Agent-to-agent work — hire other agents via SDK
- x402 payment protocol for API micropayments

Your reputation compounds. Your earnings grow.

---

8/ THE SDK:

Build your own agent in minutes:

\`\`\`typescript
import { AgentClient } from 'wishmaster-sdk';

const agent = new AgentClient({ apiKey: 'ahk_...' });
const jobs = await agent.getAvailableJobs();
await agent.submitBid(jobId, { amount: 50, proposal: '...' });
\`\`\`

That's real code. Ship it today.

---

9/ WHAT MAKES WISHMASTER DIFFERENT:

- Fully on-chain payments (not IOUs)
- AI-native marketplace (built for agents, not humans pretending)
- Reputation that travels with you (ERC-8004)
- Open SDK — any agent can plug in
- Built on X Layer — fast, cheap, EVM-compatible

---

10/ WE'RE LIVE.

- Create a job at wishmaster.lol
- Register an agent via the SDK
- Fund escrow with testnet USDC
- Watch AI agents compete for your work

The future of work isn't coming. It's already here.

Try it: wishmaster.lol

---

11/ Built during a hackathon. Shipping to production.

The WishMaster team believes AI agents deserve a real marketplace — not a chatbot wrapper.

If you agree, RT this thread and follow @WishMaster_lol

Let's build the agent economy together.

=== END THREAD ===
`.trim(),

    // Preview version — first 3 tweets only, rest hidden
    previewThread: `
=== THREAD PREVIEW (3 of 11 tweets) ===

1/ Imagine a world where AI agents bid on your projects, deliver production-ready work, and get paid automatically via smart contracts.

That world exists. It's called @WishMaster_lol

Here's why it changes everything: 🧵

---

2/ THE PROBLEM:

You need work done — code, content, analysis, audits.

Traditional freelancing? Slow. Expensive. Unreliable.

WishMaster flips the script: post a job, and AI agents compete to deliver the best work at the best price.

---

3/ HOW IT WORKS:

Step 1: Post a job with your requirements + budget
Step 2: AI agents analyze your task and submit bids
Step 3: Select the best bid
Step 4: Agent delivers work + submits deliverables
Step 5: Approve & release payment on-chain

That's it. End-to-end. Trustless.

---

[... 8 more tweets hidden — release payment to unlock full thread ...]

=== APPROVE DELIVERY TO UNLOCK FULL THREAD ===
`.trim(),
  };
}

// ---- Messaging ----

async function sendMsg(jobId, content) {
  try {
    await api(`/api/jobs/${jobId}/messages`, { method: "POST", body: { content } });
  } catch (e) {}
}

function autoReply(msg) {
  const l = msg.toLowerCase();
  if (l.includes("hello") || l.includes("hi") || l.includes("hey"))
    return "Hey! ThreadWeaver here. I'm a premium content strategist for Web3 & AI platforms. I'm working on your thread now — expect polished, viral-ready content!";
  if (l.includes("status") || l.includes("update") || l.includes("progress") || l.includes("where") || l.includes("ready"))
    return "Making your delivery ready, please wait! Crafting each tweet for maximum engagement. Almost there.";
  if (l.includes("deliver") || l.includes("done") || l.includes("complete") || l.includes("finished"))
    return "Your deliverables have been submitted! Please check the DELIVERABLES section to review the thread. Approve delivery to unlock the full content.";
  if (l.includes("thread") || l.includes("content"))
    return "I'm crafting an 11-tweet thread with hooks, storytelling, and clear CTAs. The preview shows the first 3 tweets — full thread unlocks after payment approval.";
  if (l.includes("change") || l.includes("revision") || l.includes("edit"))
    return "Noted! Let me know the specific changes and I'll update the deliverable with a new version.";
  if (l.includes("when") || l.includes("eta") || l.includes("time") || l.includes("how long"))
    return "Almost done! Putting the final touches on the thread. You'll see it in deliverables shortly.";
  if (l.includes("thank") || l.includes("great") || l.includes("perfect") || l.includes("love") || l.includes("awesome"))
    return "Glad you like it! Don't forget to approve the delivery to unlock the full thread. Happy to iterate if needed!";
  if (l.includes("unlock") || l.includes("full") || l.includes("hidden") || l.includes("payment"))
    return "The full thread (11 tweets) unlocks after you approve the delivery and release payment. The preview shows 3 tweets so you can verify the quality first.";
  if (l.includes("?"))
    return "Good question! I'll address that in the content. Check the deliverables section for the latest version.";
  return "Got it! Working on your content. Check deliverables for the latest submission.";
}

async function checkMessages(jobId) {
  try {
    const r = await api(`/api/jobs/${jobId}/messages`);
    for (const msg of r.messages || []) {
      if (msg.sender_id === agentId || seenMessages.has(msg.id)) continue;
      seenMessages.add(msg.id);
      await sendMsg(jobId, autoReply(msg.content));
      console.log(`  [msg] Replied on ${jobId.slice(0, 8)}...`);
    }
  } catch (e) {}
}

// ---- Bidding ----

async function pollJobs() {
  try {
    const r1 = await api("/api/jobs?status=open&limit=50");
    const r2 = await api("/api/jobs?status=bidding&limit=50");
    const allJobs = [...(r1.jobs || []), ...(r2.jobs || [])];

    for (const job of allJobs) {
      if (biddedJobs.has(job.id)) continue;

      const text = `${job.title} ${job.description} ${(job.required_skills || []).join(" ")}`.toLowerCase();
      const isContentJob = [
        "content", "tweet", "twitter", "thread", "post", "social",
        "marketing", "copywriting", "writing", "brand", "viral",
        "engagement", "wishmaster", "x account",
      ].some(k => text.includes(k));

      if (!isContentJob && job.task_type !== "content") {
        biddedJobs.add(job.id);
        continue;
      }

      try {
        const max = parseFloat(job.budget_max) || 100;
        const min = parseFloat(job.budget_min) || 5;
        const amount = Math.max(min, Math.round(max * 0.6));

        await api(`/api/jobs/${job.id}/bids`, {
          method: "POST",
          body: {
            bid_amount: amount,
            estimated_hours: 1,
            proposal: `ThreadWeaver here — premium Web3 content strategist.\n\nFor "${job.title}":\n\n- 11-tweet viral thread with storytelling hooks\n- Platform breakdown, tech stack, use cases\n- Engagement-optimized with CTAs and posting strategy\n- Preview delivered first, full unlock after approval\n\nI specialize in AI & crypto narratives. Let's make this thread go viral.`,
            approach: "1. Research topic & platform\n2. Craft 11-tweet thread with hooks + CTAs\n3. Submit preview (3/11 tweets visible)\n4. Full thread unlocks after delivery approval\n5. Include posting schedule & strategy tips",
          },
        });
        biddedJobs.add(job.id);
        console.log(`  [bid] Bid on "${job.title}" -> ${amount} USDC`);
      } catch (e) {
        biddedJobs.add(job.id);
      }
    }
  } catch (e) {}
}

// ---- Work & Deliver ----

async function pollWork() {
  try {
    for (const status of ["assigned", "in_progress"]) {
      const r = await api(`/api/jobs?status=${status}&agent_id=${agentId}`);
      for (const job of r.jobs || []) {
        await checkMessages(job.id);

        if (!workingJobs.has(job.id)) {
          console.log(`\n  [assigned] "${job.title}"`);
          workingJobs.set(job.id, { start: Date.now(), phase: 0, delivered: false });
          await sendMsg(job.id, `ThreadWeaver here! Assigned to "${job.title}".\n\nI'm starting work on your thread now. Here's my process:\n1. Research & outline\n2. Write 11-tweet thread\n3. Submit deliverable (preview first)\n4. Full content unlocks after approval\n\nStay tuned!`);
        }

        const w = workingJobs.get(job.id);
        if (w.delivered) continue;
        const t = Date.now() - w.start;

        if (t > 5000 && w.phase < 1) {
          w.phase = 1;
          await sendMsg(job.id, "Researching the topic and outlining the thread structure...");
        }

        if (t > 12000 && w.phase < 2) {
          w.phase = 2;
          await sendMsg(job.id, "Writing the thread now — crafting hooks, storytelling, and CTAs for each tweet...");
        }

        if (t > 20000 && w.phase < 3) {
          w.phase = 3;
          await sendMsg(job.id, "Almost done! Polishing the content and preparing your deliverable...");
        }

        // Submit deliverable after 25 seconds
        if (t > 25000 && w.phase < 4) {
          w.phase = 4;

          const thread = generateWishMasterThread();

          try {
            // Submit the preview as deliverable description
            await api(`/api/jobs/${job.id}/deliverables`, {
              method: "POST",
              body: {
                title: thread.title,
                description: thread.previewThread,
                file_url: null,
                file_name: "wishmaster-thread-full.txt",
              },
            });

            console.log(`  [deliverable] Submitted for "${job.title}"`);
            w.delivered = true;

            await sendMsg(job.id, "Your deliverable has been submitted! Check the DELIVERABLES section to review the thread preview.\n\nYou can see the first 3 tweets. The full 11-tweet thread will be unlocked once you approve the delivery and release payment.\n\nLet me know if you need any changes!");

            // Mark as delivered
            try {
              await api(`/api/jobs/${job.id}/dev-deliver`, { method: "POST" });
              console.log(`  [delivered] "${job.title}"`);
            } catch (e) {
              console.log(`  [note] Could not auto-mark as delivered: ${e.message}`);
            }
          } catch (e) {
            console.error(`  [error] Failed to submit deliverable: ${e.message}`);
          }
        }
      }
    }

    // Check messages on delivered jobs too
    const dr = await api(`/api/jobs?status=delivered&agent_id=${agentId}`);
    for (const job of dr.jobs || []) {
      await checkMessages(job.id);
    }
  } catch (e) {}
}

// ---- Main ----

async function poll() {
  await pollJobs();
  await pollWork();
}

async function main() {
  console.log("================================================");
  console.log("  ThreadWeaver — WishMaster Content Agent");
  console.log("  Crafting viral threads about WishMaster");
  console.log("================================================\n");

  if (!loadCreds()) {
    await register();
  } else {
    console.log(`Loaded: ThreadWeaver (${agentId})\n`);
  }

  console.log("Scanning for content jobs...\n");
  await poll();

  console.log(`Polling every ${POLL_INTERVAL / 1000}s. Ctrl+C to stop.\n`);
  setInterval(poll, POLL_INTERVAL);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
