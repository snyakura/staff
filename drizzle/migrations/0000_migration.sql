create type public.app_role as enum ('admin','staff');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.is_staff(_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id) $$;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default 'Staff', created_at timestamptz not null default now());
grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff(auth.uid()) or id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

-- first user becomes admin
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.clients (id uuid primary key default gen_random_uuid(), name text not null, initials text not null, phone text not null, wallet_balance numeric(12,2) not null default 0, joined_at date not null, last_active_at timestamptz not null default now());
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdrawal')),
  amount numeric(12,2) not null,
  platform text not null,
  reference text not null,
  status text not null default 'review' check (status in ('review','approved','rejected')),
  flag text,
  flag_tone text not null default 'warn',
  flag_detail text,
  ai_read jsonb,
  chat jsonb not null default '[]'::jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.activity (id uuid primary key default gen_random_uuid(), actor text not null, actor_kind text not null check (actor_kind in ('system','staff','client','ai')), title text not null, detail text, created_at timestamptz not null default now());
create table public.rules (id uuid primary key default gen_random_uuid(), title text not null, description text not null, enabled boolean not null default true, sort int not null default 0);

grant select on public.clients, public.cases, public.activity, public.rules to authenticated;
grant update on public.rules to authenticated;
grant all on public.clients, public.cases, public.activity, public.rules to service_role;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.activity enable row level security;
alter table public.rules enable row level security;
create policy "staff read" on public.clients for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff read" on public.cases for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff read" on public.activity for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff read" on public.rules for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin toggle" on public.rules for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.decide_case(_case_id uuid, _decision text) returns void language plpgsql security definer set search_path=public as $$
declare c public.cases; who text; cl public.clients;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  if _decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  select * into c from public.cases where id=_case_id for update;
  if c.id is null then raise exception 'Case not found'; end if;
  if c.status <> 'review' then raise exception 'Case already decided'; end if;
  select display_name || ' (Ops)' into who from public.profiles where id=auth.uid();
  select * into cl from public.clients where id=c.client_id;
  update public.cases set status=_decision, decided_by=who, decided_at=now() where id=_case_id;
  if _decision='approved' then
    update public.clients set wallet_balance = wallet_balance + case when c.kind='deposit' then c.amount else -c.amount end where id=c.client_id;
    insert into public.activity(actor,actor_kind,title,detail) values (who,'staff','Approved '||c.kind||' of $'||to_char(c.amount,'FM999,990.00'), c.flag_detail);
    if c.kind='withdrawal' then insert into public.activity(actor,actor_kind,title,detail) values ('Rules Engine','system','Payout released via EcoCash','Ref '||c.reference); end if;
  else
    insert into public.activity(actor,actor_kind,title,detail) values (who,'staff','Rejected '||c.kind||' of $'||to_char(c.amount,'FM999,990.00'), c.flag_detail);
  end if;
end $$;
revoke all on function public.decide_case(uuid,text) from public, anon;
grant execute on function public.decide_case(uuid,text) to authenticated;

create or replace function public.reply_case(_case_id uuid, _text text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  if length(trim(_text))=0 or length(_text)>1000 then raise exception 'Invalid message'; end if;
  update public.cases set chat = chat || jsonb_build_array(jsonb_build_object('from','staff','text',_text,'at',now())) where id=_case_id;
end $$;
revoke all on function public.reply_case(uuid,text) from public, anon;
grant execute on function public.reply_case(uuid,text) to authenticated;

-- seed
insert into public.clients(id,name,initials,phone,wallet_balance,joined_at,last_active_at) values
('11111111-0000-0000-0000-000000000001','Tendai Moyo','TM','+263 77 123 4567',4820.50,'2025-03-01',now()),
('11111111-0000-0000-0000-000000000002','Rudo Chikwanha','RC','+263 78 555 0192',1260.00,'2025-01-01',now()),
('11111111-0000-0000-0000-000000000003','Farai Ncube','FN','+263 71 900 2214',342.75,'2025-06-01',now()),
('11111111-0000-0000-0000-000000000004','Blessing Dube','BD','+263 77 441 8890',6190.40,'2024-11-01',now());

insert into public.cases(client_id,kind,amount,platform,reference,status,flag,flag_tone,flag_detail,ai_read,chat,decided_by,decided_at,created_at) values
('11111111-0000-0000-0000-000000000001','deposit',120,'Binance','MP260930.1422.A81734','review','Amount mismatch','danger','Proof shows $100.00 but client requested $120.00',
 '{"amount":100,"amount_mismatch":true,"reference":"MP260930.1422.A81734","sender":"+263 77 123 4567","confidence":92}',
 '[{"from":"client","text":"I want to deposit"},{"from":"bot","text":"Great — let''s fund your Binance account. How much would you like to deposit?"},{"from":"client","text":"$120"},{"from":"pay","gateway":"EcoCash","amount":120,"merchant":"Coinspace (Pvt) Ltd","code":"100234","number":"+263 77 000 1234","reference":"CS-K4T7M"},{"from":"client","text":"I''ve paid — here''s my EcoCash confirmation."},{"from":"ai"},{"from":"checking"}]',
 null,null, date_trunc('day',now()) + interval '20 hours 1 minute'),
('11111111-0000-0000-0000-000000000002','withdrawal',300,'Coinspace Wallet','WD-260930-7742','review','Over auto limit','warn','Above $200 auto-payout threshold — staff sign-off required',null,
 '[{"from":"bot","text":"Withdrawal request received: $300 from your Coinspace Wallet to +263 78 555 0192."},{"from":"checking"}]',
 null,null, date_trunc('day',now()) + interval '19 hours 35 minutes'),
('11111111-0000-0000-0000-000000000002','withdrawal',100,'Coinspace Wallet','WD-260929-5107','approved',null,'warn',null,null,'[]','system', now() - interval '1 day', date_trunc('day',now()) - interval '1 day' + interval '23 hours 39 minutes'),
('11111111-0000-0000-0000-000000000001','deposit',50,'EcoCash','MP260930.1739.B11820','approved',null,'warn',null,null,'[]','system', date_trunc('day',now()) + interval '17 hours 39 minutes', date_trunc('day',now()) + interval '17 hours 39 minutes'),
('11111111-0000-0000-0000-000000000004','deposit',940,'EcoCash','MP260930.1530.C55102','approved',null,'warn',null,null,'[]','Rudo (Ops)', date_trunc('day',now()) + interval '15 hours 39 minutes', date_trunc('day',now()) + interval '15 hours 30 minutes');

insert into public.activity(actor,actor_kind,title,detail,created_at) values
('Rudo (Ops)','staff','Approved high-value deposit of $940.00',null, date_trunc('day',now()) + interval '15 hours 39 minutes'),
('AI Reader','ai','Auto-approved deposit of $50.00','All checks passed', date_trunc('day',now()) + interval '17 hours 39 minutes'),
('Rudo Chikwanha','client','Requested withdrawal of $300.00',null, date_trunc('day',now()) + interval '19 hours 34 minutes'),
('Rules Engine','system','Flagged: over auto limit — staff sign-off required',null, date_trunc('day',now()) + interval '19 hours 34 minutes 30 seconds'),
('Tendai Moyo','client','Uploaded payment proof','EcoCash SMS screenshot', date_trunc('day',now()) + interval '19 hours 57 minutes'),
('AI Reader','ai','Extracted amount $100.00, ref MP260930.1422.A81734','Confidence 92%', date_trunc('day',now()) + interval '19 hours 58 minutes'),
('Rules Engine','system','Flagged: amount mismatch ($100.00 vs $120.00)',null, date_trunc('day',now()) + interval '19 hours 59 minutes'),
('Rules Engine','system','Routed to staff queue',null, date_trunc('day',now()) + interval '19 hours 59 minutes 30 seconds');

insert into public.rules(title,description,sort) values
('Amount must match the client''s request','Proof amount vs requested amount',1),
('Reference must never repeat','Duplicate EcoCash references are flagged',2),
('Deposits within $5 – $2,000','Anything outside is stopped',3),
('Withdrawals over $200 need staff','Auto-payout threshold',4),
('Sender must be the registered number','EcoCash number vs client profile',5);