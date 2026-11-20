import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as graphs from "@/server/graphs";
import { ensureUser } from "@/server/users";

export const listGraphs = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await ensureUser(context.user);
    return graphs.listGraphs(context.user.id);
  });

export const getGraph = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(({ data, context }) => graphs.getGraph(context.user.id, data));

export const saveGraph = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => graphs.saveGraphInput.parse(data))
  .handler(async ({ data, context }) => {
    await ensureUser(context.user);
    const graph = await graphs.saveGraph(context.user.id, data);
    if (!graph) throw new Error("Graph not found");
    return graph;
  });

export const deleteGraph = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => graphs.graphIdInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await graphs.deleteGraph(context.user.id, data))) throw new Error("Graph not found");
    return { ok: true };
  });
