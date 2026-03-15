"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ArrowRight, Code, Search, FileText, Database, Check, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createJob, publishJob } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";

const TASK_TYPES = [
  { id: "coding", name: "Coding", description: "Build features, fix bugs, write code", icon: Code },
  { id: "research", name: "Research", description: "Find information, analyze data", icon: Search },
  { id: "content", name: "Content", description: "Write articles, documentation, copy", icon: FileText },
  { id: "data", name: "Data", description: "Process, analyze, transform data", icon: Database },
];

const SKILLS = [
  "Rust", "Python", "TypeScript", "JavaScript", "Go", "SQL",
  "API Design", "Data Analysis", "Machine Learning", "Web Scraping",
  "Documentation", "Testing", "DevOps", "Blockchain", "React", "Node.js"
];

export default function NewJobPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { token, isAuthenticated, isLoading: authLoading, signIn } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (!token) {
      setError("Please sign in with your wallet first");
      return;
    }

    setLoading(true);
    try {
      // Include wallet address in the job data
      const jobData = {
        ...form,
        client_wallet: publicKey.toBase58(),
      };
      const job = await createJob(jobData, token);
      router.push(`/dashboard/jobs/${job.id}`);
    } catch (error: any) {
      console.error("Job creation error:", error);
      setError(error.message || "Failed to create job. Please try again.");
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

      {/* Auth Warning */}
      {!authLoading && !isAuthenticated && (
        <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-amber-600 dark:text-amber-400">Sign in required</p>
                <p className="text-sm text-muted-foreground">You need to sign in to post a job.</p>
              </div>
              <Button onClick={signIn} size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-500/50 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {["Task Type", "Details", "Skills", "Budget"].map((label, i) => (
            <div
              key={label}
              className={`text-xs font-medium ${
                i + 1 <= step ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Task Type */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">What type of task is this?</h2>
          <div className="grid gap-4">
            {TASK_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => updateForm({ task_type: type.id })}
                  className={`p-4 rounded-lg border text-left transition-all flex items-start gap-4 ${
                    form.task_type === type.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    form.task_type === type.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </button>
              );
            })}
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
            <Input
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="e.g., Build REST API for user authentication"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Describe what you need done in detail. Be specific about requirements, expected deliverables, and any technical constraints..."
              rows={6}
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
              <Input
                type="number"
                value={form.budget_min}
                onChange={(e) =>
                  updateForm({ budget_min: parseInt(e.target.value) || 0 })
                }
                min={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Maximum ($)
              </label>
              <Input
                type="number"
                value={form.budget_max}
                onChange={(e) =>
                  updateForm({ budget_max: parseInt(e.target.value) || 0 })
                }
                min={form.budget_min}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Complexity</label>
            <select
              value={form.complexity}
              onChange={(e) => updateForm({ complexity: e.target.value })}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="simple">Simple - Quick task, minimal research</option>
              <option value="moderate">Moderate - Standard complexity</option>
              <option value="complex">Complex - Deep work, multiple components</option>
            </select>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Check className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Review Summary</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Task Type</span>
                  <Badge variant="secondary" className="capitalize">{form.task_type}</Badge>
                </div>
                <div className="flex justify-between items-start py-2 border-b">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-medium text-right max-w-[200px] truncate">{form.title}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Budget Range</span>
                  <span className="font-semibold text-primary">
                    ${form.budget_min} - ${form.budget_max}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Complexity</span>
                  <Badge variant="outline" className="capitalize">{form.complexity}</Badge>
                </div>
                <div className="py-2">
                  <span className="text-muted-foreground block mb-2">Required Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {form.required_skills.length > 0 ? (
                      form.required_skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="font-normal">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">No specific skills required</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || form.budget_max < form.budget_min || !isAuthenticated}
              className="flex-1"
            >
              {loading ? "Creating..." : !isAuthenticated ? "Sign In Required" : "Create Job"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
