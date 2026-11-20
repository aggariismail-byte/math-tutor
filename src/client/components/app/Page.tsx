import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground";
const ACTIVE = { className: "text-foreground font-medium" };

/** The app's frame: the shell with its three sections. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex items-center gap-3">
          <Link to="/" className={LINK} activeProps={ACTIVE} activeOptions={{ exact: false, includeSearch: false }}>
            Chats
          </Link>
          <Link to="/tests" className={LINK} activeProps={ACTIVE}>
            Tests
          </Link>
          <Link to="/graphs" className={LINK} activeProps={ACTIVE}>
            Graphs
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}

/** What a page shows for an id this member has nothing under. */
export function NotFoundPage({
  title,
  backTo,
  backLabel,
}: {
  title: string;
  backTo: "/" | "/tests" | "/graphs";
  backLabel: string;
}) {
  return (
    <Page>
      <div data-testid="not-found">
        <EmptyState
          kind="filtered"
          title={title}
          action={
            <Button variant="outline" render={<Link to={backTo} />}>
              {backLabel}
            </Button>
          }
        />
      </div>
    </Page>
  );
}
