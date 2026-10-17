alter table users add column username text unique check (username ~ '^[a-z][a-z0-9_]{2,19}$');

create function users_username_immutable() returns trigger language plpgsql as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username_immutable';
  end if;
  return new;
end $$;

create trigger users_username_immutable before update of username on users
  for each row execute function users_username_immutable();
