"use client";

import { type ReactNode, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { canCreateTask, canEditTask } from "@/lib/permissions";
import {
  type TaskCreateInput,
  type TaskUpdateInput,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "@/lib/tasks-api";
import type { ProjectMember, Task, TaskStatus, UserRole } from "@/lib/types";
import { listMembers } from "@/lib/projects-api";
import { TaskCard, TaskRow } from "./task-card";
import { TaskFormModal } from "./task-form-modal";

const COLUMNS: { status: TaskStatus; label: string; emptyMsg: string }[] = [
  { status: "todo", label: "To Do", emptyMsg: "No tasks to do yet." },
  { status: "in_progress", label: "In Progress", emptyMsg: "Nothing in progress." },
  { status: "done", label: "Done", emptyMsg: "No completed tasks yet." },
];

const STATUS_HEADER_CLASS: Record<TaskStatus, string> = {
  todo: "border-b-info",
  in_progress: "border-b-warning",
  done: "border-b-success",
};

interface TaskBoardProps {
  projectId: string;
  viewerRole: UserRole;
}

type ViewMode = "board" | "list";

/** Full task board — Kanban board view + flat list view toggle. */
export function TaskBoard({ projectId, viewerRole }: TaskBoardProps) {
  const { request, user } = useAuth();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tasks = useResource(
    () => listTasks(request, projectId, { limit: 100 }),
    [projectId],
  );

  const members = useResource(
    () => listMembers(request, projectId),
    [projectId],
  );

  // A small drag threshold so clicking a card's buttons never starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const canCreate = canCreateTask(viewerRole);

  async function handleCreate(input: TaskCreateInput | TaskUpdateInput) {
    await createTask(request, input as TaskCreateInput);
    setCreateOpen(false);
    showToast({ title: "Task created", tone: "success" });
    tasks.reload();
  }

  async function handleEdit(input: TaskCreateInput | TaskUpdateInput) {
    if (!editTask) return;
    await updateTask(request, editTask.id, input as TaskUpdateInput);
    setEditTask(null);
    showToast({ title: "Task updated", tone: "success" });
    tasks.reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(request, deleteTarget.id);
      showToast({ title: "Task deleted", tone: "success" });
      setDeleteTarget(null);
      tasks.reload();
    } catch (caught) {
      showToast({
        title: "Could not delete task",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  /** Move a task to the column it was dropped on. */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const items = tasks.data?.items ?? [];
    const task = items.find((t) => t.id === String(active.id));
    const newStatus = over.id as TaskStatus;
    if (!task || task.status === newStatus) return;

    updateTask(request, task.id, { status: newStatus })
      .then(() => {
        showToast({ title: "Task moved", tone: "success" });
        tasks.reload();
      })
      .catch((caught) => {
        showToast({
          title: "Could not move task",
          description: errorMessage(caught),
          tone: "error",
        });
      });
  }

  function openEdit(task: Task) {
    setEditTask(task);
  }

  function openDelete(task: Task) {
    setDeleteTarget(task);
  }

  function taskCanEdit(task: Task): boolean {
    if (!user) return false;
    return canEditTask(viewerRole, user.id, task);
  }

  const allTasks = tasks.data?.items ?? [];
  const memberList: ProjectMember[] = members.data ?? [];

  return (
    <section>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setViewMode("board")}
            aria-pressed={viewMode === "board"}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "board"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect x="1" y="2" width="4" height="12" rx="1.2" fill="currentColor" />
              <rect x="6" y="2" width="4" height="8" rx="1.2" fill="currentColor" />
              <rect
                x="11"
                y="2"
                width="4"
                height="10"
                rx="1.2"
                fill="currentColor"
                fillOpacity="0.6"
              />
            </svg>
            Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 4h10M3 8h10M3 12h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            List
          </button>
        </div>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            id="new-task-btn"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="mr-1.5"
            >
              <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            New task
          </Button>
        )}
      </div>

      {/* Loading skeletons */}
      {tasks.loading && (
        <div
          className={
            viewMode === "board"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {viewMode === "board"
            ? [0, 1, 2].map((col) => (
                <div key={col} className="flex flex-col gap-3">
                  <Skeleton className="h-6 w-24" />
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ))
            : [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
        </div>
      )}

      {/* Error state */}
      {!tasks.loading && tasks.error && (
        <ErrorState
          title="Could not load tasks"
          description={errorMessage(tasks.error)}
          onRetry={tasks.reload}
        />
      )}

      {/* Board view */}
      {!tasks.loading && !tasks.error && viewMode === "board" && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COLUMNS.map(({ status, label, emptyMsg }) => {
              const columnTasks = allTasks.filter((t) => t.status === status);
              return (
                <div key={status} className="flex flex-col gap-3">
                  <div
                    className={`flex items-center justify-between rounded-t-lg border border-b-2 border-line bg-surface/70 px-3 py-2.5 ${STATUS_HEADER_CLASS[status]}`}
                  >
                    <span className="text-sm font-semibold text-ink">
                      {label}
                    </span>
                    <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-muted">
                      {columnTasks.length}
                    </span>
                  </div>

                  <DroppableColumn status={status}>
                    {columnTasks.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line py-10 text-center">
                        <p className="text-xs text-muted">{emptyMsg}</p>
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <DraggableTaskCard
                          key={task.id}
                          task={task}
                          members={memberList}
                          canEdit={taskCanEdit(task)}
                          onEdit={openEdit}
                          onDelete={openDelete}
                        />
                      ))
                    )}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      {/* List view */}
      {!tasks.loading && !tasks.error && viewMode === "list" && (
        <>
          {allTasks.length === 0 ? (
            <EmptyState
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <rect
                    x="9"
                    y="3"
                    width="6"
                    height="4"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M9 12h6M9 16h4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              }
              title="No tasks yet"
              description={
                canCreate
                  ? "Create your first task to get started."
                  : "No tasks have been created in this project yet."
              }
              action={
                canCreate ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    New task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {allTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  members={memberList}
                  canEdit={taskCanEdit(task)}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Create modal */}
      <TaskFormModal
        open={createOpen}
        mode="create"
        projectId={projectId}
        members={memberList}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit modal */}
      <TaskFormModal
        open={editTask !== null}
        mode="edit"
        initial={editTask ?? undefined}
        members={memberList}
        request={request}
        viewerRole={viewerRole}
        currentUserId={user?.id}
        onClose={() => setEditTask(null)}
        onSubmit={handleEdit}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete task"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete task"
        tone="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}

/** A Kanban column that highlights and accepts dropped task cards. */
function DroppableColumn({
  status,
  children,
}: {
  status: TaskStatus;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-24 flex-1 flex-col gap-2.5 rounded-xl transition-colors ${
        isOver ? "bg-accent-soft/50 ring-1 ring-accent/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

interface DraggableTaskCardProps {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** A task card draggable between columns when the user may edit the task. */
function DraggableTaskCard({
  task,
  members,
  canEdit,
  onEdit,
  onDelete,
}: DraggableTaskCardProps) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={canEdit ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
      {...(canEdit ? listeners : {})}
    >
      <TaskCard
        task={task}
        members={members}
        canEdit={canEdit}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
