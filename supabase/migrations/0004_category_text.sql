-- Categories become free-form text so users can add their own
-- (e.g. "need to buy", "phone calls", "documents") instead of being
-- limited to the fixed enum.

alter table tasks
  alter column category type text using category::text,
  alter column category set default 'other';

drop type task_category;
