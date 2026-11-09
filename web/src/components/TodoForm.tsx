import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Todo } from '../api/types';
import type { MutationResult, TodoDraft } from '../hooks/useTodos';
import {
  DESCRIPTION_MAX,
  mapServerErrors,
  toLocalInput,
  toUtcIso,
  validateTodoForm,
  type TodoFormErrors,
  type TodoFormValues,
} from '../validation/todoForm';

interface TodoFormProps {
  initial?: Todo;
  submitLabel: string;
  onSubmit: (draft: TodoDraft) => Promise<MutationResult>;
  onCancel?: () => void;
}

const EMPTY: TodoFormValues = { title: '', description: '', dueAt: '' };

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 aria-[invalid=true]:border-red-500';

/** Shared by create and edit. Validates locally first, then shows any server field errors inline. */
export function TodoForm({ initial, submitLabel, onSubmit, onCancel }: TodoFormProps) {
  const id = useId();
  const [values, setValues] = useState<TodoFormValues>(
    initial ? { title: initial.title, description: initial.description, dueAt: toLocalInput(initial.dueAt) } : EMPTY,
  );
  const [errors, setErrors] = useState<TodoFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof TodoFormValues) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateTodoForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // datetime-local has minute precision; if the user did not touch the date, keep the stored value
    // exactly rather than silently rounding seconds away.
    const dueAtUnchanged = initial !== undefined && values.dueAt === toLocalInput(initial.dueAt);
    setSubmitting(true);
    const result = await onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      dueAt: dueAtUnchanged ? initial.dueAt : toUtcIso(values.dueAt),
    });
    setSubmitting(false);
    if (result.ok) {
      if (!initial) setValues(EMPTY);
    } else {
      setErrors(mapServerErrors(result.fieldErrors)); // input is kept on any failure
    }
  }

  const descriptionLength = values.description.length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label htmlFor={`${id}-title`} className="mb-1 block text-sm font-medium text-slate-700">Title</label>
        <input
          id={`${id}-title`}
          value={values.title}
          onChange={update('title')}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          className={inputClass}
        />
        {errors.title && <p id={`${id}-title-error`} className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label htmlFor={`${id}-description`} className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          id={`${id}-description`}
          rows={2}
          value={values.description}
          onChange={update('description')}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`${id}-description-count${errors.description ? ` ${id}-description-error` : ''}`}
          className={inputClass}
        />
        <div className="mt-1 flex justify-between gap-2 text-xs">
          <span id={`${id}-description-error`} className="text-red-600">{errors.description}</span>
          <span
            id={`${id}-description-count`}
            className={descriptionLength > DESCRIPTION_MAX ? 'font-medium text-red-600' : 'text-slate-500'}
          >
            {`${descriptionLength}/${DESCRIPTION_MAX}`}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-due`} className="mb-1 block text-sm font-medium text-slate-700">Due date</label>
        <input
          id={`${id}-due`}
          type="datetime-local"
          value={values.dueAt}
          onChange={update('dueAt')}
          aria-invalid={Boolean(errors.dueAt)}
          className={inputClass}
        />
        {errors.dueAt && <p className="mt-1 text-xs text-red-600">{errors.dueAt}</p>}
      </div>

      {errors.form && <p className="text-xs text-red-600">{errors.form}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
