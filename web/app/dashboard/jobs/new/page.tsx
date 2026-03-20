"use client";

import { useState } from "react";
import Link from "next/link";

const JOB_TYPES = ["Data Analysis", "Code Review", "Content", "Research", "Custom"];

const AVAILABLE_SKILLS = [
  "Rust", "Python", "TypeScript", "JavaScript", "Go", "SQL",
  "API Design", "Data Analysis", "Machine Learning", "Web Scraping",
  "Documentation", "Testing", "DevOps", "Blockchain", "React", "Node.js",
  "Solidity", "Smart Contracts",
];

export default function NewJobPage() {
  const [step, setStep] = useState(1);
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

  const handleSubmit = () => {
    alert("Job submitted (mock)");
  };

  return (
    <div className="max-w-2xl font-mono space-y-8">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-wide">Create Job</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 border flex items-center justify-center text-sm font-medium transition-colors duration-150 ${
                s === step ? "bg-white text-black border-white" : s < step ? "bg-white/20 text-white border-white/20" : "text-gray-500 border-neutral-700/40"
              }`}
            >
              {s}
            </div>
            {i < 3 && (
              <div className={`w-12 h-px ${s < step ? "bg-white/40" : "bg-neutral-700/40"}`} />
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
                key={type}
                onClick={() => updateForm({ type })}
                className={`block w-full text-left px-4 py-3 border text-sm tracking-wide transition-colors duration-150 ${
                  form.type === type
                    ? "bg-[#1a1a1f] text-white border-neutral-500/50"
                    : "border-neutral-700/40 hover:border-neutral-600/60"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => form.type && setStep(2)}
              disabled={!form.type}
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
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
            <label className="block text-xs text-gray-500 tracking-wide mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="Enter job title..."
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-neutral-500/50 transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 tracking-wide mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Describe the job requirements..."
              rows={6}
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-neutral-500/50 resize-none transition-colors duration-150"
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
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
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
                    ? "bg-[#1a1a1f] text-white border-neutral-500/50"
                    : "border-neutral-700/40 text-gray-400 hover:border-neutral-600/60 hover:text-white"
                }`}
              >
                {skill}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-gray-500 tracking-wide mb-2">Complexity</label>
            <div className="flex gap-2">
              {["Simple", "Moderate", "Complex"].map((level) => (
                <button
                  key={level}
                  onClick={() => updateForm({ complexity: level })}
                  className={`flex-1 border px-4 py-3 text-sm tracking-wide transition-colors duration-150 ${
                    form.complexity === level
                      ? "bg-[#1a1a1f] text-white border-neutral-500/50"
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
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150"
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
            <label className="block text-xs text-gray-500 tracking-wide mb-2">Pricing Model</label>
            <div className="flex gap-2">
              {["FIXED", "HOURLY"].map((model) => (
                <button
                  key={model}
                  onClick={() => updateForm({ pricingModel: model })}
                  className={`flex-1 border px-4 py-3 text-sm tracking-wide transition-colors duration-150 ${
                    form.pricingModel === model
                      ? "bg-[#1a1a1f] text-white border-neutral-500/50"
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
              <label className="block text-xs text-gray-500 tracking-wide mb-2">Min (USDC)</label>
              <input
                type="number"
                value={form.budgetMin}
                onChange={(e) => updateForm({ budgetMin: e.target.value })}
                placeholder="0"
                className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-neutral-500/50 transition-colors duration-150"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 tracking-wide mb-2">Max (USDC)</label>
              <input
                type="number"
                value={form.budgetMax}
                onChange={(e) => updateForm({ budgetMax: e.target.value })}
                placeholder="0"
                className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-neutral-500/50 transition-colors duration-150"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 tracking-wide mb-2">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => updateForm({ deadline: e.target.value })}
              className="w-full bg-[#1a1a1f] border border-neutral-700/40 px-4 py-3 text-sm text-white outline-none focus:border-neutral-500/50 transition-colors duration-150"
            />
          </div>

          {/* Summary */}
          <div className="bg-[#1a1a1f] border border-neutral-700/40 p-4 space-y-2 text-sm">
            <p className="text-xs text-gray-500 tracking-wide mb-3">Summary</p>
            <p><span className="text-gray-500">Type:</span> {form.type}</p>
            <p><span className="text-gray-500">Title:</span> {form.title}</p>
            <p><span className="text-gray-500">Skills:</span> {form.skills.join(", ") || "None"}</p>
            <p><span className="text-gray-500">Complexity:</span> {form.complexity || "Unset"}</p>
            <p><span className="text-gray-500">Budget:</span> {form.budgetMin || "?"} - {form.budgetMax || "?"} USDC ({form.pricingModel})</p>
            <p><span className="text-gray-500">Deadline:</span> {form.deadline || "None"}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="border border-neutral-700/40 px-6 py-2 text-sm font-medium tracking-wide hover:bg-[#1a1a1f] transition-colors duration-150"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="bg-white text-black px-6 py-2 text-sm font-medium tracking-wide hover:bg-white/90 transition-colors duration-150"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
