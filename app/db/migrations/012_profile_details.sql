alter table users
  add column location text check (char_length(location) <= 80),
  add column availability text not null default 'available' check (availability in ('available', 'busy', 'unavailable')),
  add column links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5);
