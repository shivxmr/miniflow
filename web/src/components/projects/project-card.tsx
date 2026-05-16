import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, roleBadgeTone } from "@/lib/permissions";
import type { Project } from "@/lib/types";

/** A single project tile on the dashboard grid; links to the project page. */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
        </span>
        <Badge tone={roleBadgeTone(project.role)}>
          {ROLE_LABEL[project.role]}
        </Badge>
      </div>

      <h3 className="mt-4 font-display text-lg leading-snug tracking-tight text-ink">
        {project.name}
      </h3>
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
        {project.description?.trim() || "No description yet."}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
        <span className="text-xs text-faint">
          Created {formatDate(project.created_at)}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-accent transition-transform duration-150 group-hover:translate-x-0.5">
          Open
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h9M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
