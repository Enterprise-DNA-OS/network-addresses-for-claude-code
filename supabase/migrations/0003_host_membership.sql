create or replace view address_register as
 select a.*, n.name as namespace, p.id as prefix_id, p.prefix::text as subnet, p.member_type,
 case when p.id is null then 'No containing range'
 when p.member_type='prefix' then 'Address inside a container'
 when p.status='deprecated' and a.status<>'deprecated' then 'Live address in retired range'
 when a.status<>'deprecated' and family(p.prefix)=4 and masklen(p.prefix)<31 and not p.is_pool
 and (host(a.address)=host(network(p.prefix)) or host(a.address)=host(broadcast(p.prefix))) then 'Network or broadcast address'
 else null end as issue
 from addresses a join namespaces n on n.id=a.namespace_id
 left join lateral (select * from prefixes p where p.namespace_id=a.namespace_id and host(a.address)::inet <<= p.prefix order by masklen(p.prefix) desc limit 1) p on true;
