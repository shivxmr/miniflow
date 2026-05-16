"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/auth-context";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import {
  type ProjectInput,
  createProject,
  listProjects,
} from "@/lib/projects-api";

/** A board glyph reused for the dashboard's empty state. */
function BoardGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
      <rect x="9.5" y="4" width="5" height="10" rx="1.6" fill="currentColor" />
      <rect
        x="16"
        y="4"
        width="5"
        height="13"
        rx="1.6"
        fill="currentColor"
        fillOpacity="0.6"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const { request } = useAuth();
  const { showToast } = useToast();
  const projects = useResource(() => listProjects(request), []);
  const [createOpen, setCreateOpen] = useState(false);

  async function handleCreate(input: ProjectInput) {
    await createProject(request, input);
    setCreateOpen(false);
    showToast({
      title: "Project created",
      description: `“${input.name}” is ready to go.`,
      tone: "success",
    });
    projects.reload();
  }

  const isEmpty =
    !projects.loading && !projects.error && (projects.data?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Workspace</p>
          <h1 className="mt-1 font-display text-4xl leading-tight tracking-tight text-ink">
            Projects
          </h1>
          <p className="mt-2 text-muted">
            Every project you&apos;re a part of, in one place.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          New project
        </Button>
      </header>

      <div className="mt-8">
        {projects.loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="rounded-xl border border-line bg-surface p-5 shadow-card"
              >
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="mt-4 h-5 w-3/4" />
                <Skeleton className="mt-2.5 h-3.5 w-full" />
                <Skeleton className="mt-2 h-3.5 w-2/3" />
                <Skeleton className="mt-5 h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!projects.loading && projects.error && (
          <ErrorState
            description="We couldn't load your projects. Check your connection and try again."
            onRetry={projects.reload}
          />
        )}

        {isEmpty && (
          <EmptyState
            icon={<BoardGlyph />}
            title="No projects yet"
            description="Create your first project to start planning work and inviting your team."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                Create a project
              </Button>
            }
          />
        )}

        {!projects.loading && !projects.error && !isEmpty && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
