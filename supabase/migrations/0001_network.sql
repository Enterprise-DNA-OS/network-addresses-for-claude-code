create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table namespaces (
 id uuid primary key default gen_random_uuid(), name text not null unique check (btrim(name)<>''),
 owner text not null default '', purpose text not null default '', review_due date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table prefixes (
 id uuid primary key default gen_random_uuid(), namespace_id uuid not null references namespaces(id),
 name text not null, prefix cidr not null, status text not null default 'active' check(status in ('active','reserved','deprecated')),
 member_type text not null default 'address' check(member_type in ('address','prefix')), is_pool boolean not null default false,
 owner text not null default '', review_due date, description text not null default '', role text not null default '',
 source text not null default 'local', original jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(namespace_id,prefix)
);
create table addresses (
 id uuid primary key default gen_random_uuid(), namespace_id uuid not null references namespaces(id),
 address inet not null, name text not null, status text not null default 'reserved' check(status in ('active','reserved','deprecated')),
 owner text not null default '', review_due date, description text not null default '', role text not null default '',
 source text not null default 'local', original jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index addresses_namespace_host on addresses(namespace_id,host(address));
create table changes (
 id uuid primary key default gen_random_uuid(), code text not null unique, prefix_id uuid not null references prefixes(id),
 address inet not null, name text not null, owner text not null, review_due date not null,
 requester text not null, reason text not null, due date not null,
 status text not null default 'proposed' check(status in ('proposed','approved','rejected')),
 reviewer text, decision_note text, snapshot jsonb, decided_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table actions (
 id uuid primary key default gen_random_uuid(), namespace_id uuid not null references namespaces(id),
 title text not null, owner text not null, due date not null, status text not null default 'open' check(status in ('open','closed')),
 resolution text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table evidence (
 id uuid primary key default gen_random_uuid(), entity text not null check(entity in ('namespaces','prefixes','addresses')),
 record_id uuid not null, actor text not null, reference text not null, note text not null, next_review date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table import_batches (
 id uuid primary key default gen_random_uuid(), source text not null, digest text not null, kind text not null,
 inserted integer not null, unchanged integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table audit (
 id uuid primary key default gen_random_uuid(), actor text not null, operation text not null, entity text not null,
 record_id uuid, before_value jsonb, after_value jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['namespaces','prefixes','addresses','changes','actions','evidence','import_batches','audit'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
end $$;
create view address_register as
 select a.*, n.name as namespace, p.id as prefix_id, p.prefix::text as subnet, p.member_type,
 case when p.id is null then 'No containing range'
 when p.member_type='prefix' then 'Address inside a container'
 when p.status='deprecated' and a.status<>'deprecated' then 'Live address in retired range'
 when a.status<>'deprecated' and family(p.prefix)=4 and masklen(p.prefix)<31 and not p.is_pool
 and (host(a.address)=host(network(p.prefix)) or host(a.address)=host(broadcast(p.prefix))) then 'Network or broadcast address'
 else null end as issue
 from addresses a join namespaces n on n.id=a.namespace_id
 left join lateral (select * from prefixes p where p.namespace_id=a.namespace_id and host(a.address)::inet <<= p.prefix order by masklen(p.prefix) desc limit 1) p on true;
create view prefix_capacity as
 select p.id,p.namespace_id,n.name as namespace,p.name,p.prefix::text as subnet,p.member_type,p.status,p.owner,p.review_due,
 power(2::numeric,(case family(p.prefix) when 4 then 32 else 128 end)-masklen(p.prefix))
 - case when p.member_type='address' and family(p.prefix)=4 and masklen(p.prefix)<31 and not p.is_pool then 2 else 0 end as capacity,
 case when p.member_type='address' then (select count(*)::numeric from address_register a where a.prefix_id=p.id and a.status<>'deprecated')
 else coalesce((select sum(power(2::numeric,(case family(c.prefix) when 4 then 32 else 128 end)-masklen(c.prefix))) from prefixes c
 where c.namespace_id=p.namespace_id and c.prefix << p.prefix and c.status<>'deprecated'
 and not exists(select 1 from prefixes m where m.namespace_id=p.namespace_id and c.prefix << m.prefix and m.prefix << p.prefix and m.status<>'deprecated')),0) end as used
 from prefixes p join namespaces n on n.id=p.namespace_id;
create view capacity_review as select *,capacity-used as available,round(100*used/nullif(capacity,0),2) as used_percent from prefix_capacity;
create view review_queue as
 select 'namespaces'::text as entity,id,name as record,owner,review_due from namespaces where btrim(owner)='' or review_due is null or review_due<current_date
 union all select 'prefixes',id,name,owner,review_due from prefixes where status<>'deprecated' and (btrim(owner)='' or review_due is null or review_due<current_date)
 union all select 'addresses',id,name,owner,review_due from addresses where status<>'deprecated' and (btrim(owner)='' or review_due is null or review_due<current_date);
create view change_review as
 select c.id,c.code,n.name as namespace,p.name as range,c.address::text,c.name,c.requester,c.due,c.status,c.reason,
 case when c.due<current_date then 'Overdue decision' else 'Awaiting decision' end as attention
 from changes c join prefixes p on p.id=c.prefix_id join namespaces n on n.id=p.namespace_id where c.status='proposed';
create view compliance_findings as
 select 'CM-8'::text as rule,entity,id,record,'Owner or review evidence needs attention'::text as finding from review_queue
 union all select 'IP-BOUNDARY','addresses',id,name,issue from address_register where issue is not null and status<>'deprecated'
 union all select 'LOCAL-HIERARCHY','prefixes',p.id,p.name,'Address range contains a more specific live range' from prefixes p
 where p.member_type='address' and p.status<>'deprecated' and exists(select 1 from prefixes c where c.namespace_id=p.namespace_id and c.prefix << p.prefix and c.status<>'deprecated')
 union all select 'LOCAL-ACTION','actions',id,title,'Follow-up is overdue' from actions where status='open' and due<current_date;
