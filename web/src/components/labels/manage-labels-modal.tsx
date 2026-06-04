"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import type { AuthedRequest } from "@/lib/api";
import { LABEL_COLORS } from "@/lib/label-colors";
import { createLabel, deleteLabel, updateLabel } from "@/lib/labels-api";
import type { Label } from "@/lib/types";

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Disambiguates this group's swatch labels from others on the page. */
  forName?: string;
}

/** A radio-style row of preset color swatches. */
function ColorSwatches({ value, onChange, forName }: ColorSwatchesProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((color) => {
        const selected = color.value.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={color.value}
            type="button"
            aria-label={forName ? `${color.name} for ${forName}` : color.name}
            aria-pressed={selected}
            onClick={() => onChange(color.value)}
            className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
              selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
            }`}
            style={{ backgroundColor: color.value }}
          />
        );
      })}
    </div>
  );
}

interface ManageLabelsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  request: AuthedRequest;
  labels: Label[];
  /** Called after any create/rename/recolor/delete so the parent can reload. */
  onChanged: () => void;
}

/** Admin-only manager for a project's labels: create, rename, recolor, delete. */
export function ManageLabelsModal({
  open,
  onClose,
  projectId,
  request,
  labels,
  onChanged,
}: ManageLabelsModalProps) {
  const { showToast } = useToast();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0].value);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setCreateError("Enter a label name");
      return;
    }
    setCreateError(null);
    setCreating(true);
    try {
      await createLabel(request, projectId, { name, color: newColor });
      setNewName("");
      setNewColor(LABEL_COLORS[0].value);
      showToast({ title: "Label created", tone: "success" });
      onChanged();
    } catch (caught) {
      setCreateError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteLabel(request, projectId, toDelete.id);
      showToast({ title: "Label deleted", tone: "success" });
      setToDelete(null);
      onChanged();
    } catch (caught) {
      showToast({
        title: "Could not delete label",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Manage labels"
        description="Create labels and apply them to tasks to categorize work."
      >
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-3">
          <Input
            label="New label name"
            placeholder="e.g. bug, frontend, blocked"
            maxLength={40}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            error={createError}
          />
          <ColorSwatches value={newColor} onChange={setNewColor} />
          <div>
            <Button type="submit" size="sm" loading={creating}>
              Add label
            </Button>
          </div>
        </form>

        <hr className="my-5 border-line" />

        {labels.length === 0 ? (
          <p className="text-sm text-muted">No labels yet. Create one above.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                projectId={projectId}
                request={request}
                onChanged={onChanged}
                onDelete={() => setToDelete(label)}
              />
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete label"
        description={
          toDelete
            ? `Delete "${toDelete.name}"? It will be removed from every task that has it.`
            : ""
        }
        confirmLabel="Delete label"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

interface LabelRowProps {
  label: Label;
  projectId: string;
  request: AuthedRequest;
  onChanged: () => void;
  onDelete: () => void;
}

/** One editable row: rename, recolor, or delete a single label. */
function LabelRow({ label, projectId, request, onChanged, onDelete }: LabelRowProps) {
  const { showToast } = useToast();
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== label.name || color.toUpperCase() !== label.color.toUpperCase();

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await updateLabel(request, projectId, label.id, {
        name: trimmed,
        color,
      });
      showToast({ title: "Label updated", tone: "success" });
      onChanged();
    } catch (caught) {
      showToast({
        title: "Could not update label",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <input
          aria-label={`Name for ${label.name}`}
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/35"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!dirty || saving}
          loading={saving}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="hover:text-danger"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
      <ColorSwatches value={color} onChange={setColor} forName={label.name} />
    </li>
  );
}
