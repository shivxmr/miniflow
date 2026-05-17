"use client";

import { useState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizeProject } from "@/lib/ai-api";
import { type AuthedRequest, errorMessage } from "@/lib/api";

interface ProjectSummaryProps {
  request: AuthedRequest;
  projectId: string;
}

const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1.5l1.6 3.9L13.5 7 9.6 8.6 8 12.5 6.4 8.6 2.5 7l3.9-1.6L8 1.5z"
      fill="currentColor"
    />
    <path
      d="M13 11l.7 1.8L15.5 13.5 13.7 14.2 13 16l-.7-1.8L10.5 13.5l1.8-.7L13 11z"
      fill="currentColor"
    />
  </svg>
);

/**
 * A "Summarize progress" button that opens a modal with an AI-generated,
 * plain-text status summary of the project. Nothing is persisted; the summary
 * is regenerated each time the modal is opened.
 */
export function ProjectSummary({ request, projectId }: ProjectSummaryProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    setSummary("");
    try {
      setSummary(await summarizeProject(request, projectId));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    load();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        <SparkleIcon />
        Summarize progress
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Project progress"
        description="An AI-generated snapshot of where this project stands."
      >
        {loading && (
          <div className="flex flex-col gap-2.5" data-testid="summary-loading">
            <p className="text-sm text-muted">Generating summary…</p>
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-11/12 rounded" />
            <Skeleton className="h-3.5 w-2/3 rounded" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col gap-3">
            <FormAlert message={error} />
            <Button
              size="sm"
              variant="secondary"
              onClick={load}
              className="self-start"
            >
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && summary && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {summary}
          </p>
        )}
      </Modal>
    </>
  );
}
