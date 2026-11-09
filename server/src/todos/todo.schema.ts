import { z } from 'zod';
import type { FieldError } from '../http/errors';

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

const title = z
  .string({ error: (issue) => (issue.input === undefined ? 'Title is required' : 'Title must be a string') })
  .trim()
  .min(1, 'Title is required')
  .max(TITLE_MAX, `Title must be at most ${TITLE_MAX} characters`);

const description = z
  .string({ error: 'Description must be a string' })
  .trim()
  .max(DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters`);

// z.iso.datetime validates real calendar days (rejects 2026-02-30) and, with offset: true,
// requires "Z" or "±hh:mm", because a date-time without an offset is ambiguous.
const dueAt = z.iso
  .datetime({ offset: true, error: 'Due date must be an ISO 8601 date-time with a timezone offset' })
  .nullable();

export const createTodoSchema = z.strictObject({
  title,
  description: description.optional(),
  dueAt: dueAt.optional(),
});

export const updateTodoSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    dueAt: dueAt.optional(),
    completed: z.boolean({ error: 'Completed must be true or false' }).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update' });

export const listQuerySchema = z.object({
  includeCompleted: z
    .enum(['true', 'false'], { error: 'includeCompleted must be "true" or "false"' })
    .optional()
    .transform((value) => value === 'true'),
});

export const idSchema = z.uuid();

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

/** Flattens Zod issues into the API's { field, message } shape. Unknown keys become one entry each. */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ field: key, message: 'Unknown field' }))
      : [{ field: issue.path.join('.') || 'body', message: issue.message }],
  );
}
