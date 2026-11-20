import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";

export interface AiSetup {
  message: string;
  setup: string | null;
  command: string | null;
}

/** Shown in place of an answer while the Gateway has no AI model set up. */
export function AiSetupNotice({ setup }: { setup: AiSetup }) {
  return (
    <Alert data-testid="ai-setup-notice">
      <AlertTitle>AI isn't set up yet</AlertTitle>
      <AlertDescription>
        <p>{setup.setup ?? setup.message}</p>
        {setup.command ? (
          <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs">
            {setup.command}
          </code>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
