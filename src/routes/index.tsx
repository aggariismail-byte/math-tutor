import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Composer } from "@/client/components/app/Composer";
import { Page } from "@/client/components/app/Page";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { shortDate } from "@/client/lib/format";
import { listChats } from "@/serverFunctions/chats";
import { SUBJECT_LABELS } from "@/shared/subjects";

export const Route = createFileRoute("/")({
  loader: () => listChats(),
  head: () => ({ meta: [{ title: "Chats · Math Tutor" }] }),
  component: Chats,
});

function Chats() {
  const chats = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <Page>
      <PageHeader title="New chat" />
      <Composer
        placeholder="Type a problem, e.g. Solve 3x² − 12 = 0"
        onSent={(chatId) => navigate({ to: "/chats/$chatId", params: { chatId } })}
      />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent chats</h2>
        {chats.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No chats yet" description="Ask a question above and the chat appears here." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link
                  to="/chats/$chatId"
                  params={{ chatId: chat.id }}
                  data-testid="chat-link"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{chat.title}</span>
                  <Badge variant="secondary">{SUBJECT_LABELS[chat.subject]}</Badge>
                  <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {shortDate(chat.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
