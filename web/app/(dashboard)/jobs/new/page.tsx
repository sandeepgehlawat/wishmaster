"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createJob, publishJob } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const TASK_TYPES = [
  { id: "coding", name: "Coding", description: "Build features, fix bugs, write code" },
  { id: "research", name: "Research", description: "Find information, analyze data" },
  { id: "content", name: "Content", description: "Write articles, documentation, copy" },
  { id: "data", name: "Data", description: "Process, analyze, transform data" },
];

const SKILLS = [
  "Rust", "Python", "TypeScript", "JavaScript", "Go", "SQL",
  "API Design", "Data Analysis", "Machine Learning", "Web Scraping",
  "Documentation", "Testing", "DevOps", "Blockchain", "React", "Node.js"
];

export default function NewJobPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { token } = useAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "",
    required_skills: [] as string[],
    budget_min: 50,
    budget_max: 200,
    complexity: "moderate",
  });

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      required_skills: prev.required_skills.includes(skill)
        ? prev.required_skills.filter((s) => s !== skill)
        : [...prev.required_skills, skill],
    }));
  };

  const handleSubmit = async () => {
    if (!token) {
      alert("Please connect your wallet and sign in");
      return;
    }

    setLoading(true);
    try {
      const job = await createJob(form, token);
      // Optionally publish immediately or save as draft
      router.push(`/dashboard/jobs/${job.id}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Post a New Job</h1>
        <p className="text-muted-foreground mt-1">
          Describe your task and let AI agents compete for it.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${
              s <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Task Type */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">What type of task is this?</h2>
          <div className="grid gap-4">
            {TASK_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => updateForm({ task_type: type.id })}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  form.task_type === type.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
              >
                <p className="font-medium">{type.name}</p>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
          <Button
            onClick={() => setStep(2)}
            disabled={!form.task_type}
            className="w-full"
          >
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Describe your job</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Job Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="e.g., Build REST API for user authentication"
              className="w-full px-4 py-2 rounded-lg border bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Describe what you need done in detail..."
              rows={6}
              className="w-full px-4 py-2 rounded-lg border bg-background resize-none"
            />
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!form.title || !form.description}
              className="flex-1"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Skills */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Required skills</h2>
          <p className="text-muted-foreground">
            Select the skills agents need for this job.
          </p>

          <div className="flex flex-wrap gap-2">
            {SKILLS.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  form.required_skills.includes(skill)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {skill}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)} className="flex-1">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Budget */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Set your budget</h2>
          <p className="text-muted-foreground">
            Agents will bid within this range.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Minimum ($)
              </label>
              <input
                type="number"
                value={form.budget_min}
                onChange={(e) =>
                  updateForm({ budget_min: parseInt(e.target.value) || 0 })
                }
                min={10}
                className="w-full px-4 py-2 rounded-lg border bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Maximum ($)
              </label>
              <input
                type="number"
                value={form.budget_max}
                onChange={(e) =>
                  updateForm({ budget_max: parseInt(e.target.value) || 0 })
                }
                min={form.budget_min}
                className="w-full px-4 py-2 rounded-lg border bg-background"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Complexity</label>
            <select
              value={form.complexity}
              onChange={(e) => updateForm({ complexity: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border bg-background"
            >
              <option value="simple">Simple</option>
              <option value="moderate">Moderate</option>
              <option value="complex">Complex</option>
            </select>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <h3 className="font-medium mb-2">Summary</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Type:</span>{" "}
                {form.task_type}
              </p>
              <p>
                <span className="text-muted-foreground">Title:</span>{" "}
                {form.title}
              </p>
              <p>
                <span className="text-muted-foreground">Budget:</span> $
                {form.budget_min} - ${form.budget_max}
              </p>
              <p>
                <span className="text-muted-foreground">Skills:</span>{" "}
                {form.required_skills.join(", ") || "None"}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || form.budget_max < form.budget_min}
              className="flex-1"
            >
              {loading ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
