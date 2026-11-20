import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, ChevronLeft, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NotFoundPage, Page } from "@/client/components/app/Page";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Markdown } from "@/client/components/Markdown";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { answerQuestion, deleteTest, getTest } from "@/serverFunctions/tests";
import type { QuestionView } from "@/server/tests";
import { SUBJECT_LABELS } from "@/shared/subjects";
import { cn } from "cn";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const Route = createFileRoute("/tests/$testId")({
  loader: async ({ params }) => {
    if (!UUID.test(params.testId)) throw notFound();
    const test = await getTest({ data: params.testId });
    if (!test) throw notFound();
    return test;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} · Math Tutor` : "Math Tutor" }],
  }),
  notFoundComponent: () => <NotFoundPage title="Test not found" backTo="/tests" backLabel="Back to tests" />,
  component: TestPage,
});

type Question = QuestionView;

function TestPage() {
  const test = Route.useLoaderData();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const answered = test.questions.filter((q) => q.answer);
  const earned = answered.filter((q) => q.answer!.chosen === q.answer!.correct).length;

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/tests"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Practice tests
          </Link>
        }
        title={test.title}
        description={`${SUBJECT_LABELS[test.subject]} · ${test.topic}`}
        actions={
          <>
            <div className="rounded-lg border border-border px-3 py-1 text-sm">
              Score{" "}
              <span data-testid="score" className="font-semibold tabular-nums">
                {earned} / {answered.length}
              </span>
            </div>
            <Button variant="outline" size="sm" data-testid="delete-test" onClick={() => setDeleting(true)}>
              <Trash2 />
              Delete
            </Button>
          </>
        }
      />
      <ol className="space-y-4">
        {test.questions.map((question, index) => (
          <li key={question.id}>
            <QuestionCard question={question} number={index + 1} />
          </li>
        ))}
      </ol>
      {deleting ? (
        <ConfirmDialog
          title="Delete this test?"
          confirmLabel="Delete"
          destructive
          pending={pendingDelete}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setPendingDelete(true);
            try {
              await deleteTest({ data: { id: test.id } });
              await navigate({ to: "/tests" });
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : "The test wasn't deleted.");
              setPendingDelete(false);
            }
          }}
        >
          Its questions and score are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function QuestionCard({ question, number }: { question: Question; number: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const answer = question.answer;

  async function check() {
    if (picked === null) return;
    setChecking(true);
    try {
      await answerQuestion({ data: { questionId: question.id, choice: picked } });
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That answer wasn't saved.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card data-testid="question">
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{number}.</span>
          <Markdown className="min-w-0 flex-1 text-sm">{question.prompt}</Markdown>
          {answer ? (
            <Badge data-testid="result" variant={answer.chosen === answer.correct ? "success" : "destructive"}>
              {answer.chosen === answer.correct ? "Correct" : "Incorrect"}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-2" role="radiogroup" aria-label={`Question ${number} options`}>
          {question.options.map((option, index) => {
            const isCorrect = answer ? answer.correct === index : false;
            const isChosen = answer ? answer.chosen === index : picked === index;
            return (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={isChosen}
                data-testid="option"
                data-correct={answer ? String(isCorrect) : undefined}
                disabled={Boolean(answer)}
                onClick={() => setPicked(index)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors",
                  !answer && "cursor-pointer hover:bg-muted",
                  !answer && isChosen && "border-primary bg-primary/10",
                  answer && isCorrect && "border-success bg-success/10",
                  answer && isChosen && !isCorrect && "border-destructive bg-destructive/10",
                )}
              >
                <span className="w-5 shrink-0 font-medium text-muted-foreground">{String.fromCharCode(65 + index)}</span>
                <Markdown className="min-w-0 flex-1">{option}</Markdown>
                {answer && isCorrect ? <Check className="size-4 text-success" aria-label="Right answer" /> : null}
                {answer && isChosen && !isCorrect ? <X className="size-4 text-destructive" aria-label="Your answer" /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {answer ? (
            <Button variant="outline" size="sm" data-testid="show-steps" onClick={() => setShowSteps((shown) => !shown)}>
              {showSteps ? "Hide steps" : "Show steps"}
            </Button>
          ) : (
            <Button size="sm" data-testid="check-answer" disabled={picked === null} pending={checking} onClick={check}>
              Check
            </Button>
          )}
        </div>
        {answer && showSteps ? (
          <div data-testid="steps" className="rounded-lg bg-muted px-3 py-2">
            <Markdown className="text-sm">{answer.steps}</Markdown>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
