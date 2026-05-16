"use client";

import { type FormEvent, useId, useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import type { ProjectInput } from "@/lib/projects-api";
import {
  validateProjectDescription,
  validateProjectName,
} from "@/lib/validation";

interface FieldErrors {
  name?: string;
  description?: string;
}

interface ProjectFormModalProps {
  open: boolean;
  /** `create` shows an empty form; `edit` pre-fills from `initial`. */
  mode: "create" | "edit";
  initial?: { name: string; description: string | null };
  onClose: () => void;
  /**
   * Persists the project. Rejecting with an {@link ApiError} surfaces its
   * message (or field errors) inside the form; resolving lets the parent
   * close the modal.
   */
  onSubmit: (input: ProjectInput) => Promise<void>;
}

/** A create/edit dialog for a project's name and description. */
export function ProjectFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Seed (or reset) the fields when the modal opens — done during render,
  // the pattern React recommends over a setState-in-effect.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setFieldErrors({});
      setFormError("");
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nameError = validateProjectName(name);
    const descriptionError = validateProjectDescription(description);
    if (nameError || descriptionError) {
      setFieldErrors({
        name: nameError ?? undefined,
        description: descriptionError ?? undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      });
      // On success the parent closes the modal.
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        Object.keys(caught.fieldErrors).length > 0
      ) {
        setFieldErrors(caught.fieldErrors);
      } else {
        setFormError(
          caught instanceof ApiError
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
      setSubmitting(false);
    }
  }

  const isCreate = mode === "create";

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isCreate ? "New project" : "Edit project"}
      description={
        isCreate
          ? "Projects group your tasks and the people working on them."
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {isCreate ? "Create project" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <FormAlert message={formError} />}
        <Input
          label="Project name"
          placeholder="e.g. Website redesign"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
          autoFocus
        />
        <Textarea
          label="Description"
          hint="Optional — a short summary of what this project is for."
          placeholder="What is this project about?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldErrors.description}
        />
      </form>
    </Modal>
  );
}
