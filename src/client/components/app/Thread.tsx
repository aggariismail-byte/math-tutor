import { FileText } from "lucide-react";
import { Markdown } from "@/client/components/Markdown";

export interface ThreadMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachment: { id: string; name: string; mime: string } | null;
}

export function Thread({ messages }: { messages: ThreadMessage[] }) {
  return (
    <ol className="space-y-6">
      {messages.map((message) => (
        <li key={message.id} data-testid="message" data-role={message.role}>
          {message.role === "user" ? <Question message={message} /> : <Answer content={message.content} />}
        </li>
      ))}
    </ol>
  );
}

function Question({ message }: { message: ThreadMessage }) {
  const file = message.attachment;
  return (
    <div className="ml-auto flex w-fit max-w-[85%] flex-col items-end gap-2">
      {file ? (
        <a
          data-testid="attachment"
          href={`/api/files/${file.id}`}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-border text-sm transition-colors hover:bg-muted"
        >
          {file.mime.startsWith("image/") ? (
            <img src={`/api/files/${file.id}`} alt={file.name} className="max-h-48 max-w-full object-contain" />
          ) : (
            <span className="flex items-center gap-2 px-3 py-2">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              {file.name}
            </span>
          )}
        </a>
      ) : null}
      {message.content ? (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{message.content}</div>
      ) : null}
    </div>
  );
}

function Answer({ content }: { content: string }) {
  return <Markdown className="text-sm [&_math[display=block]]:my-3 [&_math[display=block]]:text-base">{content}</Markdown>;
}
