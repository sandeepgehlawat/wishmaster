"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { addRequirement, deleteRequirement, updateRequirement } from "@/lib/api";
import type { Requirement, CreateRequirementInput, RequirementPriority } from "@/lib/types";

interface RequirementsEditorProps {
  jobId: string;
  requirements: Requirement[];
  token: string;
  onUpdate: () => void;
  disabled?: boolean;
}

const PRIORITY_OPTIONS: { value: RequirementPriority; label: string; color: string }[] = [
  { value: "must_have", label: "Must Have", color: "text-red-400" },
  { value: "should_have", label: "Should Have", color: "text-yellow-400" },
  { value: "nice_to_have", label: "Nice to Have", color: "text-green-400" },
];

export default function RequirementsEditor({
  jobId,
  requirements,
  token,
  onUpdate,
  disabled = false,
}: RequirementsEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newReq, setNewReq] = useState<CreateRequirementInput>({
    title: "",
    description: "",
    acceptance_criteria: "",
    priority: "must_have",
  });

  const handleAdd = async () => {
    if (!newReq.title.trim()) return;

    try {
      setSaving(true);
      await addRequirement(jobId, newReq, token);
      setNewReq({
        title: "",
        description: "",
        acceptance_criteria: "",
        priority: "must_have",
      });
      setIsAdding(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to add requirement:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this requirement?")) return;

    try {
      await deleteRequirement(id, token);
      onUpdate();
    } catch (error) {
      console.error("Failed to delete requirement:", error);
    }
  };

  const handleUpdate = async (id: string, data: Partial<CreateRequirementInput>) => {
    try {
      await updateRequirement(id, data, token);
      setEditingId(null);
      onUpdate();
    } catch (error) {
      console.error("Failed to update requirement:", error);
    }
  };

  return (
    <div className="border-2 border-white">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wider">REQUIREMENTS</h3>
        <span className="text-xs text-white/50">
          {requirements.length} items
        </span>
      </div>

      {/* Requirements List */}
      <div className="divide-y divide-white/10">
        {requirements.map((req, index) => (
          <div
            key={req.id}
            className={`p-4 ${req.status !== "pending" ? "opacity-60" : ""}`}
          >
            {editingId === req.id ? (
              // Edit mode
              <EditRequirementForm
                requirement={req}
                onSave={(data) => handleUpdate(req.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              // View mode
              <div className="flex items-start gap-3">
                <div className="text-white/30 cursor-grab">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white/50">
                      #{index + 1}
                    </span>
                    <span
                      className={`text-[10px] uppercase ${
                        PRIORITY_OPTIONS.find((p) => p.value === req.priority)?.color
                      }`}
                    >
                      {req.priority.replace("_", " ")}
                    </span>
                    {req.status !== "pending" && (
                      <span className="text-[10px] uppercase text-blue-400">
                        {req.status}
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium mb-1">{req.title}</h4>
                  {req.description && (
                    <p className="text-sm text-white/70 mb-2">{req.description}</p>
                  )}
                  {req.acceptance_criteria && (
                    <div className="text-xs text-white/50 border-l-2 border-white/20 pl-2">
                      <span className="font-bold">Acceptance:</span> {req.acceptance_criteria}
                    </div>
                  )}
                </div>
                {!disabled && req.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(req.id)}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {requirements.length === 0 && !isAdding && (
          <div className="p-8 text-center text-white/50 text-sm">
            No requirements yet. Add your first requirement to get started.
          </div>
        )}
      </div>

      {/* Add Form */}
      {isAdding ? (
        <div className="p-4 border-t border-white/30 bg-white/5">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Requirement title..."
              value={newReq.title}
              onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
              className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
            <textarea
              placeholder="Description (optional)..."
              value={newReq.description || ""}
              onChange={(e) => setNewReq({ ...newReq, description: e.target.value })}
              className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-20 resize-none"
            />
            <textarea
              placeholder="Acceptance criteria - how will you verify this is done?"
              value={newReq.acceptance_criteria || ""}
              onChange={(e) => setNewReq({ ...newReq, acceptance_criteria: e.target.value })}
              className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-20 resize-none"
            />
            <select
              value={newReq.priority}
              onChange={(e) =>
                setNewReq({ ...newReq, priority: e.target.value as RequirementPriority })
              }
              className="bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newReq.title.trim() || saving}
                className="border-2 border-green-400 text-green-400 px-4 py-2 text-sm hover:bg-green-400 hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Requirement
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="border-2 border-white/50 text-white/50 px-4 py-2 text-sm hover:border-white hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        !disabled && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full p-4 border-t border-white/30 text-white/50 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Requirement
          </button>
        )
      )}
    </div>
  );
}

function EditRequirementForm({
  requirement,
  onSave,
  onCancel,
}: {
  requirement: Requirement;
  onSave: (data: Partial<CreateRequirementInput>) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState({
    title: requirement.title,
    description: requirement.description || "",
    acceptance_criteria: requirement.acceptance_criteria || "",
    priority: requirement.priority,
  });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={data.title}
        onChange={(e) => setData({ ...data, title: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400"
      />
      <textarea
        value={data.description}
        onChange={(e) => setData({ ...data, description: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-16 resize-none"
      />
      <textarea
        value={data.acceptance_criteria}
        onChange={(e) => setData({ ...data, acceptance_criteria: e.target.value })}
        className="w-full bg-black border-2 border-white px-3 py-2 text-sm focus:outline-none focus:border-green-400 h-16 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(data)}
          className="border-2 border-green-400 text-green-400 px-3 py-1 text-xs hover:bg-green-400 hover:text-black transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="border-2 border-white/50 text-white/50 px-3 py-1 text-xs hover:border-white hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
