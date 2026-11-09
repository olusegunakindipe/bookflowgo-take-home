import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { json, makeTodo, mockFetch } from './test/helpers';

const addForm = () => within(screen.getByRole('region', { name: 'Add a todo' }));

describe('App: target behaviours', () => {
  it('shows the list in ordinal order', async () => {
    mockFetch().mockResolvedValueOnce(json(200, [makeTodo({ title: 'First' }), makeTodo({ title: 'Second' })]));
    render(<App />);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => within(li).getByRole('heading').textContent)).toEqual(['First', 'Second']);
  });

  it('creates a todo, sends trimmed values and UTC due date, then clears the form', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(json(200, []));
    fetchMock.mockResolvedValueOnce(json(201, makeTodo({ title: 'Buy milk' })));
    render(<App />);
    await screen.findByText('No todos to show.');

    await user.type(addForm().getByLabelText('Title'), '  Buy milk ');
    await user.click(addForm().getByRole('button', { name: 'Add todo' }));

    expect(await screen.findByRole('heading', { name: 'Buy milk' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/todos', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Buy milk', description: '', dueAt: null }),
    }));
    expect(addForm().getByLabelText('Title')).toHaveValue('');
  });

  it('blocks submit with inline errors when the title is empty or the description is too long', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValueOnce(json(200, []));
    render(<App />);
    await screen.findByText('No todos to show.');

    await user.click(addForm().getByLabelText('Description'));
    await user.paste('x'.repeat(2001));
    await user.click(addForm().getByRole('button', { name: 'Add todo' }));

    expect(addForm().getByText('Title is required')).toBeInTheDocument();
    expect(addForm().getByText('Description must be at most 2000 characters')).toBeInTheDocument();
    expect(addForm().getByText('2001/2000')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial list load
  });

  it('completing hides the todo; "Show completed" reveals it; it can be marked incomplete', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const todo = makeTodo({ title: 'Call mum' });
    fetchMock
      .mockResolvedValueOnce(json(200, [todo]))
      .mockResolvedValueOnce(json(200, { ...todo, completed: true }))
      .mockResolvedValueOnce(json(200, [{ ...todo, completed: true }]))
      .mockResolvedValueOnce(json(200, todo));
    render(<App />);

    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Call mum" as complete' }));
    await waitFor(() => expect(screen.queryByText('Call mum')).not.toBeInTheDocument());

    await user.click(screen.getByLabelText('Show completed'));
    const box = await screen.findByRole('checkbox', { name: 'Mark "Call mum" as incomplete' });
    expect(box).toBeChecked();
    expect(fetchMock).toHaveBeenCalledWith('/api/todos?includeCompleted=true', expect.any(Object));

    await user.click(box);
    expect(await screen.findByRole('checkbox', { name: 'Mark "Call mum" as complete' })).not.toBeChecked();
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/todos/${todo.id}`, expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ completed: false }),
    }));
  });

  it('edits a todo inline', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const todo = makeTodo({ title: 'Old title' });
    fetchMock
      .mockResolvedValueOnce(json(200, [todo]))
      .mockResolvedValueOnce(json(200, { ...todo, title: 'New title' }));
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Edit "Old title"' }));
    const card = within(screen.getByRole('listitem'));
    await user.clear(card.getByLabelText('Title'));
    await user.type(card.getByLabelText('Title'), 'New title');
    await user.click(card.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'New title' })).toBeInTheDocument();
  });

  it('editing only the title keeps the stored due date exactly (no rounding to the minute)', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const todo = makeTodo({ title: 'Precise', dueAt: '2026-12-01T16:00:30.500Z' });
    fetchMock
      .mockResolvedValueOnce(json(200, [todo]))
      .mockResolvedValueOnce(json(200, { ...todo, title: 'Precise, renamed' }));
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Edit "Precise"' }));
    const card = within(screen.getByRole('listitem'));
    await user.type(card.getByLabelText('Title'), ', renamed');
    await user.click(card.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { name: 'Precise, renamed' });
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/todos/${todo.id}`, expect.objectContaining({
      body: JSON.stringify({ title: 'Precise, renamed', description: '', dueAt: '2026-12-01T16:00:30.500Z' }),
    }));
  });

  it('deletes after confirmation, and does nothing when cancelled', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const todo = makeTodo({ title: 'Bin me' });
    fetchMock.mockResolvedValueOnce(json(200, [todo])).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const confirm = vi.spyOn(window, 'confirm');
    render(<App />);

    confirm.mockReturnValueOnce(false);
    await user.click(await screen.findByRole('button', { name: 'Delete "Bin me"' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Delete "Bin me"' }));
    await waitFor(() => expect(screen.queryByText('Bin me')).not.toBeInTheDocument());
  });

  it('ignores a stale list response after "Show completed" changes again', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    const open = makeTodo({ title: 'Open task' });
    const done = makeTodo({ title: 'Done task', completed: true });
    let resolveSlow!: (r: Response) => void;
    fetchMock
      .mockResolvedValueOnce(json(200, [open]))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveSlow = resolve; }))
      .mockResolvedValueOnce(json(200, [open]));
    render(<App />);
    await screen.findByText('Open task');

    const toggle = screen.getByLabelText('Show completed');
    await user.click(toggle); // slow request (includeCompleted=true)
    await user.click(toggle); // fast request (includeCompleted=false)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async () => resolveSlow(json(200, [open, done])));

    expect(screen.queryByText('Done task')).not.toBeInTheDocument();
  });
});
