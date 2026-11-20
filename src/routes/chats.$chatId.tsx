import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Composer } from "@/client/components/app/Composer";
import { NotFoundPage, Page } from "@/client/components/app/Page";
import { Thread } from "@/client/components/app/Thread";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { deleteChat, getChat, renameChat } from "@/serverFunctions/chats";
import { SUBJECT_LABELS } from "@/shared/subjects";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const Route = createFileRoute("/chats/$chatId")({
  loader: async ({ params }) => {
    if (!UUID.test(params.chatId)) throw notFound();
    const chat = await getChat({ data: params.chatId });
    if (!chat) throw notFound();
    return chat;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.chat.title} · Math Tutor` : "Math Tutor" }],
  }),
  notFoundComponent: () => <NotFoundPage title="Chat not found" backTo="/" backLabel="Back to chats" />,
  component: ChatPage,
});

function ChatPage() {
  const { chat, messages } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Chats
          </Link>
        }
        title={chat.title}
        description={<Badge variant="secondary">{SUBJECT_LABELS[chat.subject]}</Badge>}
        actions={
          <>
            <Button variant="outline" size="sm" data-testid="rename-chat" onClick={() => setRenaming(true)}>
              <Pencil />
              Rename
            </Button>
            <Button variant="outline" size="sm" data-testid="delete-chat" onClick={() => setDeleting(true)}>
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />
      <Thread messages={messages} />
      <div ref={end}>
        <Composer chatId={chat.id} placeholder="Ask a follow-up question" onSent={() => router.invalidate()} />
      </div>
      {renaming ? (
        <RenameDialog
          id={chat.id}
          title={chat.title}
          onClose={() => setRenaming(false)}
          onSaved={async () => {
            setRenaming(false);
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          id={chat.id}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate({ to: "/" })}
        />
      ) : null}
    </Page>
  );
}

function RenameDialog({
  id,
  title,
  onClose,
  onSaved,
}: {
  id: string;
  title: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(title);
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    try {
      await renameChat({ data: { id, title: value } });
      await onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "The chat wasn't renamed.");
      setPending(false);
    }
  }
  return (
    <FormDialog
      title="Rename chat"
      onClose={onClose}
      actions={
        <Button data-testid="save-title" pending={pending} disabled={!value.trim()} onClick={save}>
          Save
        </Button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) void save();
        }}
      >
        <Input
          data-testid="chat-title-input"
          aria-label="Title"
          value={value}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
      </form>
    </FormDialog>
  );
}

function DeleteDialog({
  id,
  onClose,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmDialog
      title="Delete this chat?"
      confirmLabel="Delete"
      destructive
      pending={pending}
      onClose={onClose}
      onConfirm={async () => {
        setPending(true);
        try {
          await deleteChat({ data: { id } });
          await onDeleted();
        } catch (cause) {
          toast.error(cause instanceof Error ? cause.message : "The chat wasn't deleted.");
          setPending(false);
        }
      }}
    >
      Its messages and attached files are deleted too.
    </ConfirmDialog>
  );
}
