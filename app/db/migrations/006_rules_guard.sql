-- Al publicar una solicitud, el hash de sus reglas queda fijado on-chain. Desde ese momento la base no admite
-- nuevas versiones ni cambios de reglas, ni cambios del hash o de la versión confirmada.

create function listing_rules_guard() returns trigger language plpgsql as $$
declare current_status text;
begin
  select status into current_status from listings where id = new.listing_id;
  if current_status <> 'draft' then
    raise exception 'Las reglas de una solicitud publicada no se pueden modificar';
  end if;
  return new;
end $$;
create trigger listing_rules_guard before insert or update on listing_rules
  for each row execute function listing_rules_guard();

create function listings_published_guard() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft'
     and (new.rules_hash is distinct from old.rules_hash or new.rules_version is distinct from old.rules_version) then
    raise exception 'Las reglas de una solicitud publicada no se pueden modificar';
  end if;
  return new;
end $$;
create trigger listings_published_guard before update on listings
  for each row execute function listings_published_guard();
