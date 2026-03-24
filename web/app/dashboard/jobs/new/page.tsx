"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createJob } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { TaskType, Complexity, Urgency } from "@/lib/types";

// Map to backend TaskType enum values: coding, research, content, data, other
const JOB_TYPES = [
  { label: "CODING", value: "coding" },
  { label: "RESEARCH", value: "research" },
  { label: "CONTENT", value: "content" },
  { label: "DATA ANALYSIS", value: "data" },
  { label: "OTHER", value: "other" },
];

const AVAILABLE_SKILLS = [
  "Rust", "Python", "TypeScript", "JavaScript", "Go", "SQL",
  "API Design", "Data Analysis", "Machine Learning", "Web Scraping",
  "Documentation", "Testing", "DevOps", "Blockchain", "React", "Node.js",
  "Solidity", "Smart Contracts",
];

export default function NewJobPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "",
    title: "",
    description: "",
    skills: [] as string[],
    complexity: "",
    budgetMin: "",
    budgetMax: "",
    deadline: "",
    pricingModel: "FIXED",
  });

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = async () => {
    if (!token) {
      setError("Please connect your wallet first. Click 'SELECT WALLET' in the header.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter a job title");
      return;
    }
    if (!form.description.trim()) {
      setError("Please enter a job description");
      return;
    }
    if (!form.type) {
      setError("Please select a job type");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const jobData = {
        title: form.title.trim(),
        description: form.description.trim(),
        task_type: form.type as TaskType,
        required_skills: form.skills.length > 0 ? form.skills : ["general"],
        complexity: (form.complexity ? form.complexity.toLowerCase() : "moderate") as Complexity,
        budget_min: Number(form.budgetMin) || 100,
        budget_max: Number(form.budgetMax) || 500,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        urgency: "standard" as Urgency,
      };

      const result = await createJob(jobData, token);
      const jobId = result.id || (result as any).job?.id;
      if (jobId) {
        router.push(`/dashboard/jobs/${jobId}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create job. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl font-mono space-y-8 min-w-0">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold tracking-wide">Create Job</h1>

      {/* Error Message */}
      {error && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-0 overflow-x-auto">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 border flex items-center justify-center text-sm font-medium transition-colors duration-150 flex-shrink-0 ${
                s === step ? "bg-white text-black border-white" : s < step ? "bg-secondary-400/20 text-secondary-400 border-secondary-500/20" : "text-neutral-500 border-neutral-700/40"
              }`}
            >
              {s}
            </div>
            {i < 3 && (
              <div className={`w-8 sm:w-12 h-px flex-shrink-0 ${s < step ? "bg-secondary-400/40" : "bg-neutral-700/40"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 - TYPE */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wide">Select Job Type</h2>
          <div className="space-y-2">
            {JOB_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => updateForm({ type: type.value })}
                className={`block w-full text-left px-4 py-3 border text-sm tracking-wider transition-colors ${
                  form.type === type.value
                    ? "bg-white text-black border-white"
                    : "border-neutral-700/40 hover:border-neutral-600/60 hover:bg-[#1a1a1f]"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => form.type && setStep(2)}
              disabled={!form.type}
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-neutral-200 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2 - DETAILS */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wide">Job Details</h2>

          <div>
            <label className="block text-xs text-neutral-500 tracking-wide mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="Enter job title..."
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 tracking-wide mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Describe the job requirements..."
              rows={6}
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 resize-none transition-colors duration-150"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="border border-neutral-700/40 px-6 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
            >
              Back
            </button>
            <button
              onClick={() => form.title && form.description && setStep(3)}
              disabled={!form.title || !form.description}
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-neutral-200 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - SKILLS */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wide">Required Skills</h2>

          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SKILLS.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`border px-3 py-1.5 text-xs tracking-wide transition-colors duration-150 ${
                  form.skills.includes(skill)
                    ? "bg-[#1a1a1f] text-white border-secondary-500/30"
                    : "border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-white"
                }`}
              >
                {skill}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 tracking-wide mb-2">Complexity</label>
            <div className="flex gap-2">
              {["Simple", "Moderate", "Complex"].map((level) => (
                <button
                  key={level}
                  onClick={() => updateForm({ complexity: level })}
                  className={`flex-1 border px-4 py-3 text-sm tracking-wide transition-colors duration-150 ${
                    form.complexity === level
                      ? "bg-[#1a1a1f] text-white border-secondary-500/30"
                      : "border-neutral-700/40 hover:border-neutral-600/60"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="border border-neutral-700/40 px-6 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-neutral-200 transition-colors duration-150"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4 - BUDGET */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wide">Budget & Deadline</h2>

          <div>
            <label className="block text-xs text-neutral-500 tracking-wide mb-2">Pricing Model</label>
            <div className="flex gap-2">
              {["FIXED", "HOURLY"].map((model) => (
                <button
                  key={model}
                  onClick={() => updateForm({ pricingModel: model })}
                  className={`flex-1 border px-4 py-3 text-sm tracking-wide transition-colors duration-150 ${
                    form.pricingModel === model
                      ? "bg-[#1a1a1f] text-white border-secondary-500/30"
                      : "border-neutral-700/40 hover:border-neutral-600/60"
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 tracking-wide mb-2">Min (USDC)</label>
              <input
                type="number"
                value={form.budgetMin}
                onChange={(e) => updateForm({ budgetMin: e.target.value })}
                placeholder="0"
                className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors duration-150"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 tracking-wide mb-2">Max (USDC)</label>
              <input
                type="number"
                value={form.budgetMax}
                onChange={(e) => updateForm({ budgetMax: e.target.value })}
                placeholder="0"
                className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors duration-150"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 tracking-wide mb-2">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => updateForm({ deadline: e.target.value })}
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white outline-none focus:border-neutral-500 transition-colors duration-150"
            />
          </div>

          {/* Summary */}
          <div className="border border-neutral-700/40 bg-[#1a1a1f] p-4 space-y-2 text-sm">
            <p className="text-xs text-neutral-500 tracking-wider mb-3">SUMMARY</p>
            <p><span className="text-neutral-500">TYPE:</span> {form.type.toUpperCase()}</p>
            <p><span className="text-neutral-500">TITLE:</span> {form.title}</p>
            <p><span className="text-neutral-500">SKILLS:</span> {form.skills.join(", ") || "NONE"}</p>
            <p><span className="text-neutral-500">COMPLEXITY:</span> {form.complexity || "UNSET"}</p>
            <p><span className="text-neutral-500">BUDGET:</span> {form.budgetMin || "?"} - {form.budgetMax || "?"} USDC ({form.pricingModel})</p>
            <p><span className="text-neutral-500">DEADLINE:</span> {form.deadline || "NONE"}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              disabled={loading}
              className="border border-neutral-700/40 px-6 py-2 text-sm font-bold tracking-wider hover:bg-[#1a1a1f] transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-white text-black px-6 py-2 text-sm font-bold tracking-wider hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "[SUBMITTING...]" : "[SUBMIT]"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
