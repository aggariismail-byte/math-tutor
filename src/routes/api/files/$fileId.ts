import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { getFile } from "@/server/chats";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A file a member attached to a chat, only for that member.
export const Route = createFileRoute("/api/files/$fileId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (!UUID.test(params.fileId)) return new Response("Not found", { status: 404 });
        const file = await getFile(user.id, params.fileId);
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(file.object.body, {
          headers: {
            "content-type": file.mime,
            "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
