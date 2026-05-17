"use client";

import { type FormEvent, useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/use-resource";
import { type AuthedRequest, errorMessage } from "@/lib/api";
import {
  createSubtask,
  deleteSubtask,
  generateSubtasks,
  listSubtasks,
  updateSubtask,
} from "@/lib/subtasks-api";
import type { Subtask } from "@/lib/types";

/** An AI-suggested subtask the user can edit, keep, or discard before saving. */
interface Suggestion {
  key: string;
  title: string;
  checked: boolean;
}

interface SubtaskListProps {
  request: AuthedRequest;
  taskId: string;
}

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent/35 focus:ring-offset-1 focus:ring-offset-paper";

const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1.5l1.6 3.9L13.5 7 9.6 8.6 8 12.5 6.4 8.6 2.5 7l3.9-1.6L8 1.5z"
      fill="currentColor"
    />
    <path d="M13 11l.7 1.8L15.5 13.5 13.7 14.2 13 16l-.7-1.8L10.5 13.5l1.8-.7L13 11z" fill="currentColor" />
  </svg>
);

/**
 * The subtask checklist shown inside the task edit modal. Supports manual
 * add/toggle/delete plus an "AI generate" flow where suggestions are reviewed
 * before being saved.
 */
export function SubtaskList({ request, taskId }: SubtaskListProps) {
  const subtasks = useResource(() => listSubtasks(request, taskId), [taskId]);

  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const items: Subtask[] = subtasks.data ?? [];
  const doneCount = items.filter((s) => s.is_done).length;

  /** Runs a mutation, then reloads the list and surfaces any error inline. */
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      subtasks.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    setError("");
    try {
      await createSubtask(request, taskId, title);
      setNewTitle("");
      subtasks.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const titles = await generateSubtasks(request, taskId);
      setSuggestions(
        titles.map((title, index) => ({
          key: `suggestion-${index}`,
          title,
          checked: true,
        })),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSuggestions() {
    if (!suggestions) return;
    const chosen = suggestions
      .filter((s) => s.checked && s.title.trim())
      .map((s) => s.title.trim());
    if (chosen.length === 0) {
      setSuggestions(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await Promise.all(chosen.map((t) => createSubtask(request, taskId, t)));
      setSuggestions(null);
      subtasks.reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function patchSuggestion(key: string, patch: Partial<Suggestion>) {
    setSuggestions(
      (prev) =>
        prev?.map((s) => (s.key === key ? { ...s, ...patch } : s)) ?? prev,
    );
  }

  const chosenCount =
    suggestions?.filter((s) => s.checked && s.title.trim()).length ?? 0;

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Subtasks</h3>
        {items.length > 0 && (
          <span className="text-xs font-medium text-muted">
            {doneCount} / {items.length} done
          </span>
        )}
      </div>

      {subtasks.loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-2/3 rounded-lg" />
        </div>
      )}

      {!subtasks.loading && (
        <ul className="flex flex-col gap-1.5">
          {items.map((subtask) => (
            <li
              key={subtask.id}
              data-testid="subtask-item"
              className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2"
            >
              <input
                type="checkbox"
                checked={subtask.is_done}
                disabled={busy}
                aria-label={subtask.title}
                onChange={() =>
                  mutate(() =>
                    updateSubtask(request, taskId, subtask.id, {
                      is_done: !subtask.is_done,
                    }),
                  )
                }
                className="h-4 w-4 shrink-0 accent-accent"
              />
              <span
                className={
                  "min-w-0 flex-1 truncate text-sm " +
                  (subtask.is_done
                    ? "text-faint line-through"
                    : "text-ink")
                }
              >
                {subtask.title}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Delete subtask: ${subtask.title}`}
                onClick={() =>
                  mutate(() => deleteSubtask(request, taskId, subtask.id))
                }
                className="shrink-0 rounded p-1 text-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <FormAlert message={error} />}

      {/* Add a subtask manually */}
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a subtask"
          aria-label="New subtask title"
          maxLength={220}
          className={FIELD_CLASS}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy}>
          Add
        </Button>
      </form>

      {/* AI generation */}
      {suggestions === null ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          loading={generating}
          disabled={generating}
          onClick={handleGenerate}
          className="self-start text-accent hover:text-accent-hover"
        >
          {!generating && <SparkleIcon />}
          {generating ? "Generating…" : "Generate with AI"}
        </Button>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-lg border border-accent/30 bg-accent-soft/40 p-3">
          <p className="text-xs font-semibold text-accent-ink">
            Review AI suggestions
          </p>
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted">No suggestions were returned.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((suggestion) => (
                <li key={suggestion.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={suggestion.checked}
                    aria-label={`Keep suggestion: ${suggestion.title}`}
                    onChange={(e) =>
                      patchSuggestion(suggestion.key, {
                        checked: e.target.checked,
                      })
                    }
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <input
                    value={suggestion.title}
                    aria-label={`Edit suggestion: ${suggestion.title}`}
                    maxLength={220}
                    onChange={(e) =>
                      patchSuggestion(suggestion.key, {
                        title: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={saving || chosenCount === 0}
              onClick={handleSaveSuggestions}
            >
              {`Add ${chosenCount} subtask${chosenCount === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setSuggestions(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
