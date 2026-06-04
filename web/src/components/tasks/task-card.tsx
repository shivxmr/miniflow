"use client";

import { LabelPicker } from "@/components/labels/label-picker";
import { LabelPillList } from "@/components/labels/label-pill";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuthedRequest } from "@/lib/api";
import { initial } from "@/lib/format";
import type { Label, ProjectMember, Task, TaskPriority, TaskStatus } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

interface TaskCardProps {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** All labels defined on the project, offered by the label picker. */
  projectLabels: Label[];
  /** Whether the viewer may attach/detach labels on this task. */
  canApplyLabels: boolean;
  request: AuthedRequest;
  /** Called with the task returned after a label is added or removed. */
  onTaskChange: (task: Task) => void;
}

/** A compact task card shown in a Kanban column or list row. */
export function TaskCard({
  task,
  members,
  canEdit,
  onEdit,
  onDelete,
  projectLabels,
  canApplyLabels,
  request,
  onTaskChange,
}: TaskCardProps) {
  const assignee = members.find((m) => m.user.id === task.assigned_to);

  return (
    <article
      className="group relative rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-pop"
      data-testid="task-card"
    >
      {/* Priority badge */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <Badge tone={PRIORITY_TONE[task.priority]}>
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        <div className="flex items-center gap-1">
          {canApplyLabels && (
            <LabelPickerDnd
              request={request}
              task={task}
              projectLabels={projectLabels}
              onTaskChange={onTaskChange}
            />
          )}
          {canEdit && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Edit task: ${task.title}`}
                onClick={() => onEdit(task)}
                className="h-7 px-2 text-xs"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete task: ${task.title}`}
                onClick={() => onDelete(task)}
                className="h-7 px-2 text-xs hover:text-danger"
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      <h3 className="text-sm font-medium leading-snug text-ink line-clamp-2">
        {task.title}
      </h3>

      {task.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted line-clamp-2">
          {task.description}
        </p>
      )}

      {task.labels.length > 0 && (
        <LabelPillList labels={task.labels} className="mt-2.5" />
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
        {task.due_date && (
          <span className="flex items-center gap-1">
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="2"
                y="3"
                width="12"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5 1.5v3M11 1.5v3M2 7h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {task.due_date}
          </span>
        )}
        {assignee && (
          <span
            aria-label={`Assigned to ${assignee.user.name}`}
            title={assignee.user.name}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
          >
            {initial(assignee.user.name)}
          </span>
        )}
      </div>
    </article>
  );
}

/** A compact row used in the flat list view. */
export function TaskRow({
  task,
  members,
  canEdit,
  onEdit,
  onDelete,
  projectLabels,
  canApplyLabels,
  request,
  onTaskChange,
}: TaskCardProps) {
  const assignee = members.find((m) => m.user.id === task.assigned_to);

  return (
    <li
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-shadow hover:shadow-card"
      data-testid="task-row"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{task.title}</p>
        {task.description && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {task.description}
          </p>
        )}
        {task.labels.length > 0 && (
          <LabelPillList labels={task.labels} className="mt-1.5" />
        )}
      </div>
      {canApplyLabels && (
        <LabelPicker
          request={request}
          task={task}
          projectLabels={projectLabels}
          onTaskChange={onTaskChange}
        />
      )}
      <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
      <Badge
        tone={
          task.status === "done"
            ? "success"
            : task.status === "in_progress"
              ? "info"
              : "neutral"
        }
      >
        {STATUS_LABEL[task.status]}
      </Badge>
      {assignee && (
        <span
          aria-label={`Assigned to ${assignee.user.name}`}
          title={assignee.user.name}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
        >
          {initial(assignee.user.name)}
        </span>
      )}
      {task.due_date && (
        <span className="shrink-0 text-xs text-muted">{task.due_date}</span>
      )}
      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit task: ${task.title}`}
            onClick={() => onEdit(task)}
            className="h-7 px-2 text-xs"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete task: ${task.title}`}
            onClick={() => onDelete(task)}
            className="h-7 px-2 text-xs hover:text-danger"
          >
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * The label picker wrapped so pointer interactions don't start a card drag.
 * On the board a card is draggable; stopping pointerdown here keeps clicks on
 * the picker (and its popover) from being interpreted as a drag.
 */
function LabelPickerDnd(props: Parameters<typeof LabelPicker>[0]) {
  return (
    <div onPointerDown={(event) => event.stopPropagation()}>
      <LabelPicker {...props} />
    </div>
  );
}
