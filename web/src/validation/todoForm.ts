import type { FieldError } from '../api/types';

// Must match the server (spec §2). Both sides count UTF-16 code units via .length.
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

export interface TodoFormValues {
  title: string;
  description: string;
  dueAt: string; // value of <input type="datetime-local">, or ''
}

export type TodoFormErrors = Partial<Record<'title' | 'description' | 'dueAt' | 'form', string>>;

/** Instant UX feedback only; the server remains the authority. */
export function validateTodoForm(values: TodoFormValues): TodoFormErrors {
  const errors: TodoFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length > TITLE_MAX) errors.title = `Title must be at most ${TITLE_MAX} characters`;

  if (values.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX} characters`;
  }
  if (values.dueAt) {
    const due = new Date(values.dueAt);
    if (Number.isNaN(due.getTime())) errors.dueAt = 'Enter a valid due date';
    // Same rule as the server: the UTC form must have a 4-digit year.
    else if (!/^\d{4}-/.test(due.toISOString())) errors.dueAt = 'Due date is out of range';
  }
  return errors;
}

/** datetime-local values have no offset and are read as the browser's local time, then sent as UTC. */
export function toUtcIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" in local time, for pre-filling the edit form. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Puts server field errors on the matching inputs; anything unexpected becomes a form-level message. */
export function mapServerErrors(fieldErrors: FieldError[]): TodoFormErrors {
  const errors: TodoFormErrors = {};
  for (const { field, message } of fieldErrors) {
    const key = field === 'title' || field === 'description' || field === 'dueAt' ? field : 'form';
    errors[key] ??= message;
  }
  return errors;
}
