"use client";

import { type FormEvent, useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { generateTaskDrafts } from "@/lib/ai-api";
import { type AuthedRequest, errorMessage } from "@/lib/api";
import { createTask } from "@/lib/tasks-api";
import type { TaskPriority } from "@/lib/types";

interface TaskDraftModalProps {
  open: boolean;
  onClose: () => void;
  request: AuthedRequest;
  projectId: string;
  /** Called with how many drafts were created as real tasks. */
  onCreated: (count: number) => void;
}

/** An AI-suggested task the user can edit, keep, or discard before creating. */
interface DraftRow {
  key: string;
  title: string;
  description: string;
  priority: TaskPriority;
  checked: boolean;
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent/35 focus:ring-offset-1 focus:ring-offset-paper";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 " +
  "text-sm text-ink placeholder:text-faint transition-colors focus:border-accent " +
  "focus:outline-none focus:ring-2 focus:ring-accent/35 focus:ring-offset-1 " +
  "focus:ring-offset-paper";

/**
 * A modal that turns a free-text note into reviewable draft tasks. The user
 * describes the work, reviews and edits the AI's suggestions, then bulk-creates
 * the ones they keep as real tasks. Nothing is saved until "Add tasks".
 */
export function TaskDraftModal({
  open,
  onClose,
  request,
  projectId,
  onCreated,
}: TaskDraftModalProps) {
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setText("");
    setGenerating(false);
    setDrafts(null);
    setSaving(false);
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateTaskDrafts(request, projectId, trimmed);
      setDrafts(
        result.map((draft, index) => ({
          key: `draft-${index}`,
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          checked: true,
        })),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setGenerating(false);
    }
  }

  function patchDraft(key: string, patch: Partial<DraftRow>) {
    setDrafts(
      (prev) =>
        prev?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? prev,
    );
  }

  const kept = drafts?.filter((d) => d.checked && d.title.trim()) ?? [];

  async function handleCreate() {
    if (kept.length === 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        kept.map((d) =>
          createTask(request, {
            project_id: projectId,
            title: d.title.trim(),
            description: d.description.trim() || null,
            priority: d.priority,
          }),
        ),
      );
      const count = kept.length;
      reset();
      onClose();
      onCreated(count);
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Draft tasks with AI"
      description="Describe the work in plain English, then review the tasks before adding them."
    >
      {drafts === null ? (
        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Launch the new marketing site: design the landing page, write the copy, set up analytics, and QA on mobile."
            aria-label="Describe the work"
            rows={5}
            maxLength={4000}
            className={TEXTAREA_CLASS}
          />
          {error && <FormAlert message={error} />}
          <Button
            type="submit"
            size="sm"
            loading={generating}
            disabled={generating || text.trim().length === 0}
            className="self-end"
          >
            {generating ? "Generating…" : "Generate tasks"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-muted">
              No tasks were suggested. Try rephrasing your note.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {drafts.map((draft) => (
                <li
                  key={draft.key}
                  data-testid="task-draft-row"
                  className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={draft.checked}
                      aria-label={`Keep draft: ${draft.title}`}
                      onChange={(e) =>
                        patchDraft(draft.key, { checked: e.target.checked })
                      }
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    <input
                      value={draft.title}
                      aria-label={`Edit draft title: ${draft.title}`}
                      maxLength={220}
                      onChange={(e) =>
                        patchDraft(draft.key, { title: e.target.value })
                      }
                      className={FIELD_CLASS}
                    />
                  </div>
                  <textarea
                    value={draft.description}
                    aria-label={`Edit draft description: ${draft.title}`}
                    rows={2}
                    maxLength={4000}
                    onChange={(e) =>
                      patchDraft(draft.key, { description: e.target.value })
                    }
                    className={TEXTAREA_CLASS}
                  />
                  <Select
                    aria-label={`Priority for: ${draft.title}`}
                    options={PRIORITY_OPTIONS}
                    value={draft.priority}
                    onChange={(e) =>
                      patchDraft(draft.key, {
                        priority: e.target.value as TaskPriority,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {error && <FormAlert message={error} />}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={saving || kept.length === 0}
              onClick={handleCreate}
            >
              {`Add ${kept.length} task${kept.length === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDrafts(null);
                setError("");
              }}
            >
              Start over
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
