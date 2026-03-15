"use client";

import { useState } from "react";
import Link from "next/link";

const JOB_TYPES = ["DATA_ANALYSIS", "CODE_REVIEW", "CONTENT", "RESEARCH", "CUSTOM"];

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
      <h1 className="text-2xl font-bold tracking-wider">{`>>> CREATE_JOB`}</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 border-2 border-white flex items-center justify-center text-sm font-bold ${
                s === step ? "bg-white text-black" : s < step ? "bg-white/20 text-white" : "text-white/50"
              }`}
            >
              {s}
            </div>
            {i < 3 && (
              <div className={`w-12 h-[2px] ${s < step ? "bg-white" : "bg-white/30"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 - TYPE */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wider">SELECT JOB TYPE</h2>
          <div className="space-y-0">
            {JOB_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => updateForm({ type })}
                className={`block w-full text-left px-4 py-3 border-2 border-white -mt-[2px] first:mt-0 text-sm tracking-wider transition-colors ${
                  form.type === type
                    ? "bg-white text-black"
                    : "hover:bg-white/5"
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
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [NEXT]
            </button>
          </div>
        </div>
      )}

      {/* Step 2 - DETAILS */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wider">JOB DETAILS</h2>

          <div>
            <label className="block text-xs text-white/60 tracking-wider mb-2">TITLE</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
              placeholder="Enter job title..."
              className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 tracking-wider mb-2">DESCRIPTION</label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Describe the job requirements..."
              rows={6}
              className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5 resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [BACK]
            </button>
            <button
              onClick={() => form.title && form.description && setStep(3)}
              disabled={!form.title || !form.description}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [NEXT]
            </button>
          </div>
        </div>
      )}

      {/* Step 3 - SKILLS */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wider">REQUIRED SKILLS</h2>

          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SKILLS.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`border-2 border-white px-3 py-1.5 text-xs tracking-wider transition-colors ${
                  form.skills.includes(skill)
                    ? "bg-white text-black"
                    : "hover:bg-white/5"
                }`}
              >
                {skill}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-white/60 tracking-wider mb-2">COMPLEXITY</label>
            <div className="flex gap-0">
              {["SIMPLE", "MODERATE", "COMPLEX"].map((level) => (
                <button
                  key={level}
                  onClick={() => updateForm({ complexity: level })}
                  className={`flex-1 border-2 border-white -ml-[2px] first:ml-0 px-4 py-3 text-sm tracking-wider transition-colors ${
                    form.complexity === level
                      ? "bg-white text-black"
                      : "hover:bg-white/5"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [BACK]
            </button>
            <button
              onClick={() => setStep(4)}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [NEXT]
            </button>
          </div>
        </div>
      )}

      {/* Step 4 - BUDGET */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-lg tracking-wider">BUDGET &amp; DEADLINE</h2>

          <div>
            <label className="block text-xs text-white/60 tracking-wider mb-2">PRICING MODEL</label>
            <div className="flex gap-0">
              {["FIXED", "HOURLY"].map((model) => (
                <button
                  key={model}
                  onClick={() => updateForm({ pricingModel: model })}
                  className={`flex-1 border-2 border-white -ml-[2px] first:ml-0 px-4 py-3 text-sm tracking-wider transition-colors ${
                    form.pricingModel === model
                      ? "bg-white text-black"
                      : "hover:bg-white/5"
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 tracking-wider mb-2">MIN (USDC)</label>
              <input
                type="number"
                value={form.budgetMin}
                onChange={(e) => updateForm({ budgetMin: e.target.value })}
                placeholder="0"
                className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 tracking-wider mb-2">MAX (USDC)</label>
              <input
                type="number"
                value={form.budgetMax}
                onChange={(e) => updateForm({ budgetMax: e.target.value })}
                placeholder="0"
                className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/60 tracking-wider mb-2">DEADLINE</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => updateForm({ deadline: e.target.value })}
              className="w-full bg-black border-2 border-white px-4 py-3 text-sm text-white outline-none focus:bg-white/5"
            />
          </div>

          {/* Summary */}
          <div className="border-2 border-white p-4 space-y-2 text-sm">
            <p className="text-xs text-white/60 tracking-wider mb-3">SUMMARY</p>
            <p><span className="text-white/50">TYPE:</span> {form.type}</p>
            <p><span className="text-white/50">TITLE:</span> {form.title}</p>
            <p><span className="text-white/50">SKILLS:</span> {form.skills.join(", ") || "NONE"}</p>
            <p><span className="text-white/50">COMPLEXITY:</span> {form.complexity || "UNSET"}</p>
            <p><span className="text-white/50">BUDGET:</span> {form.budgetMin || "?"} - {form.budgetMax || "?"} USDC ({form.pricingModel})</p>
            <p><span className="text-white/50">DEADLINE:</span> {form.deadline || "NONE"}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              [BACK]
            </button>
            <button
              onClick={handleSubmit}
              className="border-2 border-white px-6 py-2 text-sm font-bold tracking-wider bg-white text-black hover:bg-black hover:text-white transition-colors"
            >
              [SUBMIT]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
