import type { Todo } from '../api/types';
import { TodoItem, type TodoItemProps } from './TodoItem';

type TodoListProps = { todos: Todo[] } & Omit<TodoItemProps, 'todo'>;

export function TodoList({ todos, ...handlers }: TodoListProps) {
  if (todos.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No todos to show.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} {...handlers} />
      ))}
    </ul>
  );
}
