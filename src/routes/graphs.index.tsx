import { createFileRoute, Link } from "@tanstack/react-router";
import { LineChart, Plus } from "lucide-react";
import { Page } from "@/client/components/app/Page";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { shortDate } from "@/client/lib/format";
import { listGraphs } from "@/serverFunctions/graphs";

export const Route = createFileRoute("/graphs/")({
  loader: () => listGraphs(),
  head: () => ({ meta: [{ title: "Graphs · Math Tutor" }] }),
  component: Graphs,
});

function Graphs() {
  const graphs = Route.useLoaderData();
  return (
    <Page>
      <PageHeader
        title="Graphs"
        actions={
          <Button data-testid="new-graph" render={<Link to="/graphs/$graphId" params={{ graphId: "new" }} />}>
            <Plus />
            New graph
          </Button>
        }
      />
      {graphs.length === 0 ? (
        <EmptyState icon={LineChart} title="No graphs yet" description="Make one with New graph and it appears here." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {graphs.map((graph) => (
            <li key={graph.id}>
              <Link
                to="/graphs/$graphId"
                params={{ graphId: graph.id }}
                data-testid="graph-link"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{graph.title}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {graph.expressions.join("  ·  ")}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{shortDate(graph.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
