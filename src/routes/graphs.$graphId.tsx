import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { GraphPlot, SERIES_FILLS } from "@/client/components/app/GraphPlot";
import { NotFoundPage, Page } from "@/client/components/app/Page";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { compileExpression } from "@/client/lib/plot";
import { deleteGraph, getGraph, saveGraph } from "@/serverFunctions/graphs";
import { cn } from "cn";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_EXPRESSIONS = 8;

interface GraphData {
  id: string | null;
  title: string;
  expressions: string[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const BLANK: GraphData = {
  id: null,
  title: "",
  expressions: [""],
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10,
};

export const Route = createFileRoute("/graphs/$graphId")({
  loader: async ({ params }): Promise<GraphData> => {
    if (params.graphId === "new") return BLANK;
    if (!UUID.test(params.graphId)) throw notFound();
    const graph = await getGraph({ data: params.graphId });
    if (!graph) throw notFound();
    return graph;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title || "New graph"} · Math Tutor` }],
  }),
  notFoundComponent: () => <NotFoundPage title="Graph not found" backTo="/graphs" backLabel="Back to graphs" />,
  component: GraphPage,
});

function GraphPage() {
  const graph = Route.useLoaderData();
  // A fresh editor per graph, so opening another one starts from its saved state.
  return <GraphEditor key={graph.id ?? "new"} graph={graph} />;
}

function GraphEditor({ graph }: { graph: GraphData }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [title, setTitle] = useState(graph.title);
  const [rows, setRows] = useState(() => graph.expressions.map((text, slot) => ({ slot, text })));
  const [range, setRange] = useState({
    xMin: String(graph.xMin),
    xMax: String(graph.xMax),
    yMin: String(graph.yMin),
    yMax: String(graph.yMax),
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const compiled = useMemo(
    () => rows.map((row) => ({ ...row, result: row.text.trim() ? compileExpression(row.text) : null })),
    [rows],
  );
  const numbers = {
    xMin: Number(range.xMin),
    xMax: Number(range.xMax),
    yMin: Number(range.yMin),
    yMax: Number(range.yMax),
  };
  const rangeError =
    !Object.values(range).every((v) => v.trim() !== "" && Number.isFinite(Number(v)))
      ? "Enter a number for each bound."
      : numbers.xMin >= numbers.xMax
        ? "x min must be less than x max."
        : numbers.yMin >= numbers.yMax
          ? "y min must be less than y max."
          : null;
  const series = compiled.flatMap((row) =>
    row.result?.ok ? [{ slot: row.slot, fn: row.result.fn, label: row.text }] : [],
  );
  const hasError = compiled.some((row) => row.result && !row.result.ok);
  const expressions = rows.map((row) => row.text.trim()).filter(Boolean);
  const canSave = title.trim() && expressions.length > 0 && !hasError && !rangeError;

  function setRow(slot: number, text: string) {
    setRows((current) => current.map((row) => (row.slot === slot ? { ...row, text } : row)));
  }
  function addRow() {
    setRows((current) => {
      const used = new Set(current.map((row) => row.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      return [...current, { slot, text: "" }];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await saveGraph({
        data: { ...(graph.id ? { id: graph.id } : {}), title: title.trim(), expressions, ...numbers },
      });
      toast.success("Graph saved");
      if (!graph.id) {
        await navigate({ to: "/graphs/$graphId", params: { graphId: saved.id } });
      } else {
        await router.invalidate();
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The graph wasn't saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/graphs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Graphs
          </Link>
        }
        title={graph.id ? graph.title : "New graph"}
        actions={
          <>
            {graph.id ? (
              <Button variant="outline" data-testid="delete-graph" onClick={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </Button>
            ) : null}
            <Button data-testid="save-graph" pending={saving} disabled={!canSave} onClick={save}>
              Save
            </Button>
          </>
        }
      />
      <div className="space-y-2">
        <Label htmlFor="graph-title">Title</Label>
        <Input
          id="graph-title"
          data-testid="graph-title"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Parabola and its tangent"
        />
      </div>
      <div className="space-y-3">
        <Label>Expressions in x</Label>
        <ul className="space-y-2">
          {compiled.map((row) => (
            <li key={row.slot} className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 rounded-full", SERIES_FILLS[row.slot % SERIES_FILLS.length])}
                />
                <Input
                  data-testid="expression-input"
                  aria-label="Expression"
                  aria-invalid={row.result && !row.result.ok ? true : undefined}
                  value={row.text}
                  maxLength={200}
                  onChange={(event) => setRow(row.slot, event.target.value)}
                  placeholder="e.g. x^2 - 3 or sin(x)"
                  className="font-mono"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-testid="remove-expression"
                  aria-label="Remove expression"
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((r) => r.slot !== row.slot))}
                >
                  <X />
                </Button>
              </div>
              {row.result && !row.result.ok ? (
                <p data-testid="expression-error" className="pl-5 text-sm text-destructive">
                  {row.result.error}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          data-testid="add-expression"
          disabled={rows.length >= MAX_EXPRESSIONS}
          onClick={addRow}
        >
          <Plus />
          Add expression
        </Button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["xMin", "x-min", "x min"],
              ["xMax", "x-max", "x max"],
              ["yMin", "y-min", "y min"],
              ["yMax", "y-max", "y max"],
            ] as const
          ).map(([key, testId, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={testId}>{label}</Label>
              <Input
                id={testId}
                data-testid={testId}
                type="number"
                step="any"
                value={range[key]}
                onChange={(event) => setRange((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        {rangeError ? <p className="text-sm text-destructive">{rangeError}</p> : null}
        <GraphPlot series={series} range={numbers} />
      </div>
      {deleting && graph.id ? (
        <ConfirmDialog
          title="Delete this graph?"
          confirmLabel="Delete"
          destructive
          pending={pendingDelete}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setPendingDelete(true);
            try {
              await deleteGraph({ data: { id: graph.id! } });
              await navigate({ to: "/graphs" });
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "The graph wasn't deleted.");
              setPendingDelete(false);
            }
          }}
        >
          This can't be undone.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
