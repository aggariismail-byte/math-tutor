import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { graphs } from "@/db/schema";

const range = z.number().finite().min(-1e6).max(1e6);

export const saveGraphInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Give the graph a title").max(120),
    expressions: z.array(z.string().trim().min(1).max(200)).min(1, "Add an expression").max(8),
    xMin: range,
    xMax: range,
    yMin: range,
    yMax: range,
  })
  .strict()
  .refine((g) => g.xMin < g.xMax, "The x range's minimum must be below its maximum")
  .refine((g) => g.yMin < g.yMax, "The y range's minimum must be below its maximum");
export const graphIdInput = z.object({ id: z.string().uuid() }).strict();

export interface Graph {
  id: string;
  title: string;
  expressions: string[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  updatedAt: number;
}

function graphOf(row: typeof graphs.$inferSelect): Graph {
  return {
    id: row.id,
    title: row.title,
    expressions: JSON.parse(row.expressions) as string[],
    xMin: row.xMin,
    xMax: row.xMax,
    yMin: row.yMin,
    yMax: row.yMax,
    updatedAt: row.updatedAt,
  };
}

export async function listGraphs(ownerId: string): Promise<Graph[]> {
  const rows = await db
    .select()
    .from(graphs)
    .where(eq(graphs.ownerId, ownerId))
    .orderBy(desc(graphs.updatedAt));
  return rows.map(graphOf);
}

export async function getGraph(ownerId: string, id: string): Promise<Graph | null> {
  const [row] = await db
    .select()
    .from(graphs)
    .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId)));
  return row ? graphOf(row) : null;
}

/** Creates the graph, or updates this member's graph with the id; null when they have none. */
export async function saveGraph(
  ownerId: string,
  { id, expressions, ...fields }: z.infer<typeof saveGraphInput>,
): Promise<Graph | null> {
  const now = Date.now();
  const values = { ...fields, expressions: JSON.stringify(expressions), updatedAt: now };
  if (!id) {
    const [row] = await db
      .insert(graphs)
      .values({ id: crypto.randomUUID(), ownerId, createdAt: now, ...values })
      .returning();
    return graphOf(row!);
  }
  const [row] = await db
    .update(graphs)
    .set(values)
    .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId)))
    .returning();
  return row ? graphOf(row) : null;
}

export async function deleteGraph(ownerId: string, { id }: z.infer<typeof graphIdInput>) {
  const [row] = await db
    .delete(graphs)
    .where(and(eq(graphs.id, id), eq(graphs.ownerId, ownerId)))
    .returning({ id: graphs.id });
  return Boolean(row);
}
