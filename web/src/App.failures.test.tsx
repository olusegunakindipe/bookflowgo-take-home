import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { MESSAGES } from './api/todosApi';
import { json, makeTodo, mockFetch } from './test/helpers';

const addForm = () => within(screen.getByRole('region', { name: 'Add a todo' }));

async function submitNewTodo(title: string) {
  const user = userEvent.setup();
  await screen.findByText('No todos to show.');
  await user.type(addForm().getByLabelText('Title'), title);
  await user.click(addForm().getByRole('button', { name: 'Add todo' }));
  return user;
}

describe('App: failure handling', () => {
  it('500 on create: shows the server banner and keeps the input', async () => {
    mockFetch()
      .mockResolvedValueOnce(json(200, []))
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }));
    render(<App />);
    await submitNewTodo('Keep me');

    expect(await screen.findByText(MESSAGES.server)).toBeInTheDocument();
    expect(addForm().getByLabelText('Title')).toHaveValue('Keep me');
    expect(screen.getByText('No todos to show.')).toBeInTheDocument();
  });

  it('network failure: shows the distinct "can\'t reach" banner, which can be dismissed', async () => {
    mockFetch().mockResolvedValueOnce(json(200, [])).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<App />);
    const user = await submitNewTodo('Offline');

    expect(await screen.findByText(MESSAGES.network)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByText(MESSAGES.network)).not.toBeInTheDocument();
  });

  it('API down behind the dev proxy (plain-text 500): shows "can\'t reach", not "not saved"', async () => {
    mockFetch()
      .mockResolvedValueOnce(json(200, []))
      .mockResolvedValueOnce(new Response('', { status: 500, headers: { 'Content-Type': 'text/plain' } }));
    render(<App />);
    await submitNewTodo('Proxy says no');

    expect(await screen.findByText(MESSAGES.network)).toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.server)).not.toBeInTheDocument();
    expect(addForm().getByLabelText('Title')).toHaveValue('Proxy says no');
  });

  it('server 400: maps field errors onto the matching input', async () => {
    mockFetch()
      .mockResolvedValueOnce(json(200, []))
      .mockResolvedValueOnce(json(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [{ field: 'title', message: 'Title is required' }] },
      }));
    render(<App />);
    await submitNewTodo('Looks fine locally');

    expect(await addForm().findByText('Title is required')).toBeInTheDocument();
    expect(addForm().getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('initial load failure: shows an error with Retry instead of an empty list', async () => {
    const user = userEvent.setup();
    mockFetch()
      .mockResolvedValueOnce(json(503, { error: { code: 'INTERNAL_ERROR', message: 'x' } }))
      .mockResolvedValueOnce(json(200, [makeTodo({ title: 'Back again' })]));
    render(<App />);

    expect(await screen.findByText("Couldn't load your todos.")).toBeInTheDocument();
    expect(screen.queryByText('No todos to show.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Back again')).toBeInTheDocument();
  });

  it('404 on toggle: shows "no longer exists" and reloads the list', async () => {
    const user = userEvent.setup();
    const ghost = makeTodo({ title: 'Ghost' });
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(json(200, [ghost]))
      .mockResolvedValueOnce(json(404, { error: { code: 'NOT_FOUND', message: 'Todo not found' } }))
      .mockResolvedValueOnce(json(200, []));
    render(<App />);

    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Ghost" as complete' }));

    expect(await screen.findByText(MESSAGES.notFound)).toBeInTheDocument();
    expect(await screen.findByText('No todos to show.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('a field-level 400 on a toggle (no form to show it on) still shows a banner', async () => {
    const user = userEvent.setup();
    const todo = makeTodo({ title: 'Toggle me' });
    mockFetch()
      .mockResolvedValueOnce(json(200, [todo]))
      .mockResolvedValueOnce(json(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [{ field: 'completed', message: 'Completed must be true or false' }] },
      }));
    render(<App />);

    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Toggle me" as complete' }));

    expect(await screen.findByText(MESSAGES.unknown)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mark "Toggle me" as complete' })).not.toBeChecked();
  });
});
