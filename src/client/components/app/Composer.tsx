import { FileText, Paperclip, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { AiSetupNotice, type AiSetup } from "@/client/components/app/AiSetupNotice";
import { SubjectSelect } from "@/client/components/app/SubjectSelect";
import { Button } from "@/client/components/ui/button";
import { Spinner } from "@/client/components/ui/spinner";
import { Textarea } from "@/client/components/ui/textarea";
import { sendMessage } from "@/serverFunctions/chats";
import type { Subject } from "@/shared/subjects";
import { UPLOAD_ACCEPT, uploadProblem } from "@/shared/uploads";

/**
 * Where a member asks: a question, an optional photo or PDF, and (for a new
 * chat) the subject. `onSent` gets the chat the answer was saved to.
 */
export function Composer({
  chatId,
  placeholder,
  onSent,
}: {
  chatId?: string;
  placeholder: string;
  onSent: (chatId: string) => Promise<void> | void;
}) {
  const [subject, setSubject] = useState<Subject>("math");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiOff, setAiOff] = useState<AiSetup | null>(null);
  const [pending, setPending] = useState<{ text: string; file: string | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function pickFile(picked: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!picked) return;
    const problem = uploadProblem(picked);
    setError(problem);
    setFile(problem ? null : picked);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || (!text.trim() && !file)) return;
    const form = new FormData();
    if (chatId) form.set("chatId", chatId);
    form.set("subject", subject);
    form.set("text", text);
    if (file) form.set("file", file);
    setError(null);
    setAiOff(null);
    setPending({ text: text.trim(), file: file?.name ?? null });
    try {
      const result = await sendMessage({ data: form });
      if ("aiOff" in result) {
        setAiOff(result.aiOff);
        return;
      }
      setText("");
      setFile(null);
      await onSent(result.chatId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't send. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {pending ? (
        <div data-testid="pending-message" className="space-y-3">
          <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
            {pending.text || pending.file}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Working it out…
          </div>
        </div>
      ) : null}
      {aiOff ? <AiSetupNotice setup={aiOff} /> : null}
      <form onSubmit={submit} className="space-y-3">
        <Textarea
          data-testid="question-input"
          aria-label="Question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={placeholder}
          rows={3}
          maxLength={8000}
        />
        {file ? (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate" data-testid="picked-file">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove file"
              onClick={() => setFile(null)}
            >
              <X />
            </Button>
          </div>
        ) : null}
        {error ? (
          <p data-testid="composer-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {chatId ? null : (
              <SubjectSelect value={subject} onChange={setSubject} testId="subject-select" className="w-36" />
            )}
            <input
              ref={fileInput}
              type="file"
              accept={UPLOAD_ACCEPT}
              data-testid="file-input"
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={Boolean(pending)}
            >
              <Paperclip />
              Photo or PDF
            </Button>
          </div>
          <Button
            type="submit"
            data-testid="send-button"
            pending={Boolean(pending)}
            disabled={!text.trim() && !file}
          >
            {chatId ? "Ask" : "Solve"}
          </Button>
        </div>
      </form>
    </div>
  );
}
