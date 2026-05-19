"use client";

import { type FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api";
import { initial } from "@/lib/format";
import {
  ROLE_LABEL,
  ROLE_ORDER,
  canManageMembers,
  roleBadgeTone,
} from "@/lib/permissions";
import {
  addMember,
  listMembers,
  removeMember,
  updateMemberRole,
} from "@/lib/projects-api";
import type { ProjectMember, UserRole } from "@/lib/types";
import { validateEmail } from "@/lib/validation";

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
}));

interface MemberPanelProps {
  projectId: string;
  /** The viewer's own role in this project; gates the management controls. */
  viewerRole: UserRole;
}

/** Lists project members and, for Admins, the controls to manage them. */
export function MemberPanel({ projectId, viewerRole }: MemberPanelProps) {
  const { request, user } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageMembers(viewerRole);

  const members = useResource(
    () => listMembers(request, projectId),
    [projectId],
  );

  // Invite form.
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Per-row mutation state.
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, UserRole>>({});
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }
    setEmailError(null);
    setInviting(true);
    try {
      await addMember(request, projectId, {
        email: email.trim(),
        role: inviteRole,
      });
      setEmail("");
      setInviteRole("member");
      showToast({ title: "Member added", tone: "success" });
      members.reload();
    } catch (caught) {
      showToast({
        title: "Could not add member",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: ProjectMember, nextRole: UserRole) {
    setPendingRole((current) => ({ ...current, [member.user.id]: nextRole }));
    setBusyUserId(member.user.id);
    try {
      await updateMemberRole(request, projectId, member.user.id, nextRole);
      showToast({
        title: "Role updated",
        description: `${member.user.name} is now a ${ROLE_LABEL[nextRole]}.`,
        tone: "success",
      });
      members.reload();
    } catch (caught) {
      showToast({
        title: "Could not update role",
        description: errorMessage(caught),
        tone: "error",
      });
      // Revert the optimistic value back to the server's truth.
      setPendingRole((current) => {
        const next = { ...current };
        delete next[member.user.id];
        return next;
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRemove() {
    if (!memberToRemove) {
      return;
    }
    setRemoving(true);
    try {
      await removeMember(request, projectId, memberToRemove.user.id);
      showToast({
        title: "Member removed",
        description: `${memberToRemove.user.name} no longer has access.`,
        tone: "success",
      });
      setMemberToRemove(null);
      members.reload();
    } catch (caught) {
      showToast({
        title: "Could not remove member",
        description: errorMessage(caught),
        tone: "error",
      });
    } finally {
      setRemoving(false);
    }
  }

  const rows = members.data?.items ?? [];
  const totalMembers = members.data?.total ?? rows.length;

  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-lg text-ink">Members</h2>
        {members.data && (
          <Badge tone="neutral">
            {totalMembers} {totalMembers === 1 ? "person" : "people"}
          </Badge>
        )}
      </header>

      {canManage && (
        <form
          onSubmit={handleInvite}
          noValidate
          className="flex flex-col gap-3 border-b border-line bg-paper/50 px-5 py-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Input
              label="Invite by email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError}
            />
          </div>
          <div className="sm:w-36">
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value as UserRole)
              }
            />
          </div>
          <Button
            type="submit"
            loading={inviting}
            className="w-full sm:w-auto"
          >
            Add
          </Button>
        </form>
      )}

      <div className="px-5 py-4">
        {members.loading && (
          <ul className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <li key={index} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-7 w-20" />
              </li>
            ))}
          </ul>
        )}

        {!members.loading && members.error && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-muted">
              We couldn&apos;t load the members of this project.
            </p>
            <Button variant="secondary" size="sm" onClick={members.reload}>
              Try again
            </Button>
          </div>
        )}

        {!members.loading && !members.error && (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((member) => {
              const isSelf = member.user.id === user?.id;
              const role = pendingRole[member.user.id] ?? member.role;
              const isBusy = busyUserId === member.user.id;
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink"
                  >
                    {initial(member.user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <span className="truncate">{member.user.name}</span>
                      {isSelf && (
                        <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 text-xs font-medium text-muted">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {member.user.email}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`Role for ${member.user.name}`}
                        options={ROLE_OPTIONS}
                        value={role}
                        disabled={isBusy}
                        onChange={(event) =>
                          handleRoleChange(
                            member,
                            event.target.value as UserRole,
                          )
                        }
                        className="h-9"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        className="hover:text-danger"
                        onClick={() => setMemberToRemove(member)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={roleBadgeTone(role)}>
                      {ROLE_LABEL[role]}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={memberToRemove !== null}
        title="Remove member"
        description={
          memberToRemove
            ? `Remove ${memberToRemove.user.name} from this project? They will lose access immediately.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
        loading={removing}
        onConfirm={handleRemove}
        onClose={() => setMemberToRemove(null)}
      />
    </section>
  );
}
