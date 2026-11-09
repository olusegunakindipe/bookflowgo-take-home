import { useState } from 'react';
import type { Todo } from '../api/types';
import type { MutationResult, TodoDraft } from '../hooks/useTodos';
import { TodoForm } from './TodoForm';

export interface TodoItemProps {
  todo: Todo;
  onToggle: (todo: Todo) => Promise<MutationResult>;
  onUpdate: (id: string, draft: TodoDraft) => Promise<MutationResult>;
  onDelete: (id: string) => Promise<MutationResult>;
}

const formatDue = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const cardClass = 'flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
const smallButton =
  'rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50';

export function TodoItem({ todo, onToggle, onUpdate, onDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className={cardClass}>
        <TodoForm
          initial={todo}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            const result = await onUpdate(todo.id, draft);
            if (result.ok) setEditing(false);
            return result;
          }}
        />
      </li>
    );
  }

  return (
    <li className={cardClass}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          disabled={busy}
          onChange={() => run(() => onToggle(todo))}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
          className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
        />
        <h3 className={`min-w-0 break-words font-medium ${todo.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {todo.title}
        </h3>
      </div>
      {todo.description && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{todo.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="text-xs text-slate-500">{todo.dueAt ? `Due ${formatDue(todo.dueAt)}` : 'No due date'}</span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            aria-label={`Edit "${todo.title}"`}
            className={`${smallButton} text-indigo-700 hover:bg-indigo-50`}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm(`Delete "${todo.title}"?`) && run(() => onDelete(todo.id))}
            aria-label={`Delete "${todo.title}"`}
            className={`${smallButton} text-red-700 hover:bg-red-50`}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
