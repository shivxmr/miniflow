"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-context";
import { MemberPanel } from "@/components/projects/member-panel";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { TaskBoard } from "@/components/tasks/task-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { ROLE_LABEL, canManageProject, roleBadgeTone } from "@/lib/permissions";
import {
  type ProjectInput,
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/projects-api";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { request } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const project = useResource(
    () => getProject(request, projectId),
    [projectId],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleEdit(input: ProjectInput) {
    await updateProject(request, projectId, input);
    setEditOpen(false);
    showToast({ title: "Project updated", tone: "success" });
    project.reload();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProject(request, projectId);
      showToast({ title: "Project deleted", tone: "success" });
      router.replace("/dashboard");
    } catch (caught) {
      showToast({
        title: "Could not delete project",
        description: errorMessage(caught),
        tone: "error",
      });
      setDeleting(false);
    }
  }

  const data = project.data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13 8H3M7 4L3 8l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to projects
      </Link>

      {project.loading && (
        <div className="mt-6">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="mt-3 h-10 w-2/3" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
      )}

      {!project.loading && project.error && (
        <div className="mt-6">
          <ErrorState
            title="Project unavailable"
            description={errorMessage(project.error)}
            onRetry={project.reload}
          />
        </div>
      )}

      {!project.loading && !project.error && data && (
        <>
          <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge tone={roleBadgeTone(data.role)}>
                Your role: {ROLE_LABEL[data.role]}
              </Badge>
              <h1 className="mt-2.5 font-display text-4xl leading-tight tracking-tight text-ink">
                {data.name}
              </h1>
              {data.description && (
                <p className="mt-2 max-w-2xl leading-relaxed text-muted">
                  {data.description}
                </p>
              )}
            </div>

            {canManageProject(data.role) && (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-danger"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              </div>
            )}
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <TaskBoard projectId={projectId} viewerRole={data.role} />
            <MemberPanel projectId={projectId} viewerRole={data.role} />
          </div>

          <ProjectFormModal
            open={editOpen}
            mode="edit"
            initial={{ name: data.name, description: data.description }}
            onClose={() => setEditOpen(false)}
            onSubmit={handleEdit}
          />
          <ConfirmDialog
            open={deleteOpen}
            title="Delete project"
            description={`Delete “${data.name}”? This permanently removes the project and all of its tasks. This cannot be undone.`}
            confirmLabel="Delete project"
            tone="danger"
            loading={deleting}
            onConfirm={handleDelete}
            onClose={() => setDeleteOpen(false)}
          />
        </>
      )}
    </div>
  );
}
