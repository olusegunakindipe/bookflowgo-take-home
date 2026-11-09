import { ErrorBanner } from './components/ErrorBanner';
import { TodoForm } from './components/TodoForm';
import { TodoList } from './components/TodoList';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const todos = useTodos();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">My ToDos</h1>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={todos.includeCompleted}
            onChange={(e) => todos.setIncludeCompleted(e.target.checked)}
            className="h-4 w-4 accent-indigo-600"
          />
          Show completed
        </label>
      </header>

      {todos.actionError && <ErrorBanner message={todos.actionError} onDismiss={todos.dismissError} />}

      <section aria-labelledby="add-todo-heading" className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="add-todo-heading" className="mb-3 text-lg font-medium">Add a todo</h2>
        <TodoForm submitLabel="Add todo" onSubmit={todos.createTodo} />
      </section>

      {todos.status === 'error' ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
          <p className="mb-3">{todos.loadError}</p>
          <button
            type="button"
            onClick={todos.reload}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Retry
          </button>
        </div>
      ) : todos.status === 'loading' && todos.items.length === 0 ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : (
        <TodoList todos={todos.items} onToggle={todos.toggleTodo} onUpdate={todos.updateTodo} onDelete={todos.deleteTodo} />
      )}
    </main>
  );
}
