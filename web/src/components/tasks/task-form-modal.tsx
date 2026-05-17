"use client";

import { type FormEvent, useId, useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, type AuthedRequest } from "@/lib/api";
import type { TaskCreateInput, TaskUpdateInput } from "@/lib/tasks-api";
import type { ProjectMember, Task, TaskPriority, TaskStatus } from "@/lib/types";
import { validateTaskTitle } from "@/lib/validation";
import { SubtaskList } from "./subtask-list";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface FieldErrors {
  title?: string;
  description?: string;
}

export interface TaskFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  /** Required in create mode to set the project_id and default status. */
  projectId?: string;
  /** Pre-fills the form when mode is "edit". */
  initial?: Task;
  /** Members shown in the assignee dropdown. */
  members: ProjectMember[];
  /**
   * Authenticated request function. When supplied in edit mode, the task's
   * subtask checklist (with AI generation) is shown below the form.
   */
  request?: AuthedRequest;
  onClose: () => void;
  /**
   * Called with a create or update payload. Rejecting with an
   * {@link ApiError} surfaces the error inside the form.
   */
  onSubmit: (input: TaskCreateInput | TaskUpdateInput) => Promise<void>;
}

/** A create / edit dialog for a task. */
export function TaskFormModal({
  open,
  mode,
  projectId,
  initial,
  members,
  request,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Seed (or reset) when modal opens — React-recommended pattern.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setStatus(initial?.status ?? "todo");
      setPriority(initial?.priority ?? "medium");
      setAssignedTo(initial?.assigned_to ?? "");
      setDueDate(initial?.due_date ?? "");
      setFieldErrors({});
      setFormError("");
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const titleError = validateTaskTitle(title);
    if (titleError) {
      setFieldErrors({ title: titleError });
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);

    try {
      const payload: TaskCreateInput | TaskUpdateInput =
        mode === "create"
          ? {
              project_id: projectId!,
              title: title.trim(),
              description: description.trim() || null,
              status,
              priority,
              assigned_to: assignedTo || null,
              due_date: dueDate || null,
            }
          : {
              title: title.trim(),
              description: description.trim() || null,
              status,
              priority,
              assigned_to: assignedTo || null,
              due_date: dueDate || null,
            };
      await onSubmit(payload);
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

  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
  ];

  const isCreate = mode === "create";

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isCreate ? "New task" : "Edit task"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={submitting}>
            {isCreate ? "Create task" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        {formError && <FormAlert message={formError} />}
        <Input
          label="Title"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          autoFocus
        />
        <Textarea
          label="Description"
          hint="Optional — add more detail about this task."
          placeholder="Describe the task…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.description}
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          />
          <Select
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Assignee"
            options={assigneeOptions}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />
          <Input
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </form>

      {!isCreate && request && initial?.id && (
        <SubtaskList request={request} taskId={initial.id} />
      )}
      </div>
    </Modal>
  );
}
