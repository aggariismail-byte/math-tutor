import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { SUBJECTS, SUBJECT_LABELS, type Subject } from "@/shared/subjects";

const ITEMS = SUBJECTS.map((value) => ({ value, label: SUBJECT_LABELS[value] }));

export function SubjectSelect({
  value,
  onChange,
  testId,
  id,
  className,
}: {
  value: Subject;
  onChange: (subject: Subject) => void;
  testId: string;
  id?: string;
  className?: string;
}) {
  return (
    <Select
      items={ITEMS}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as Subject);
      }}
    >
      <SelectTrigger id={id} data-testid={testId} aria-label="Subject" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
