import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AiSetupNotice, type AiSetup } from "@/client/components/app/AiSetupNotice";
import { Page } from "@/client/components/app/Page";
import { SubjectSelect } from "@/client/components/app/SubjectSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { shortDate } from "@/client/lib/format";
import { generateTest, listTests } from "@/serverFunctions/tests";
import { SUBJECT_LABELS, type Subject } from "@/shared/subjects";

export const Route = createFileRoute("/tests/")({
  loader: () => listTests(),
  head: () => ({ meta: [{ title: "Practice tests · Math Tutor" }] }),
  component: Tests,
});

function Tests() {
  const tests = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title="Practice tests" />
      <NewTestForm />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Your tests</h2>
        {tests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tests yet" description="Make one above and it appears here with its score." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tests.map((test) => (
              <li key={test.id}>
                <Link
                  to="/tests/$testId"
                  params={{ testId: test.id }}
                  data-testid="test-row"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{test.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SUBJECT_LABELS[test.subject]} · {test.questions} questions · {shortDate(test.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums" aria-label="Score">
                    {test.earned} / {test.attempted}
                  </span>
                  {test.attempted === test.questions ? <Badge variant="success">Done</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

function NewTestForm() {
  const navigate = useNavigate();
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState<Subject>("math");
  const [count, setCount] = useState("5");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiOff, setAiOff] = useState<AiSetup | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAiOff(null);
    setPending(true);
    try {
      const result = await generateTest({ data: { topic, subject, count: Number(count) } });
      if ("aiOff" in result) {
        setAiOff(result.aiOff);
        return;
      }
      await router.invalidate();
      await navigate({ to: "/tests/$testId", params: { testId: result.testId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The test wasn't made. Try again.");
    } finally {
      setPending(false);
    }
  }

  const countValue = Number(count);
  const countOk = Number.isInteger(countValue) && countValue >= 3 && countValue <= 10;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="topic">Topic</Label>
        <Input
          id="topic"
          data-testid="topic-input"
          value={topic}
          maxLength={300}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="e.g. Quadratic equations, Newton's second law, depreciation"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="test-subject">Subject</Label>
          <SubjectSelect id="test-subject" value={subject} onChange={setSubject} testId="test-subject" className="w-40" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="question-count">Questions</Label>
          <Input
            id="question-count"
            data-testid="question-count"
            type="number"
            min={3}
            max={10}
            value={count}
            onChange={(event) => setCount(event.target.value)}
            aria-invalid={!countOk || undefined}
            className="w-24"
          />
        </div>
        <Button type="submit" data-testid="generate-test" pending={pending} disabled={!topic.trim() || !countOk}>
          Make test
        </Button>
      </div>
      {!countOk ? <p className="text-sm text-destructive">Pick 3 to 10 questions.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {aiOff ? <AiSetupNotice setup={aiOff} /> : null}
    </form>
  );
}
