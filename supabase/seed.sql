insert into namespaces(id,name,owner,purpose,review_due) values
 ('10000000-0000-4000-8000-000000000001','Harbour Office','Morgan Lee','Fictional office network',current_date+30),
 ('10000000-0000-4000-8000-000000000002','South Warehouse','','Fictional isolated warehouse',current_date-10)
on conflict do nothing;
insert into prefixes(id,namespace_id,name,prefix,member_type,owner,review_due) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Office aggregate','10.20.0.0/16','prefix','Morgan Lee',current_date+30),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Office printers','10.20.1.0/29','address','Morgan Lee',current_date+30),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Office uplink','192.0.2.0/31','address','Morgan Lee',current_date+30),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Office IPv6','2001:db8:10::/64','address','Morgan Lee',current_date+30),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Warehouse scanners','10.20.1.0/29','address','Alex Chen',current_date-5)
on conflict do nothing;
insert into addresses(id,namespace_id,address,name,status,owner,review_due) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10.20.1.1/29','Printer gateway','active','Morgan Lee',current_date+30),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','10.20.1.2/29','Accounts printer','active','Morgan Lee',current_date+30),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10.20.1.3/29','Dispatch printer','active','Morgan Lee',current_date+30),
 ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','10.20.1.4/29','Label printer','reserved','Morgan Lee',current_date+30),
 ('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','10.20.1.5/29','Old copier','active','',current_date-20),
 ('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','10.20.1.1/29','Warehouse gateway','active','Alex Chen',current_date+30),
 ('30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000002','10.22.1.10/24','Unmapped scanner','active','Alex Chen',current_date-2),
 ('30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','2001:db8:10::1/64','IPv6 gateway','active','Morgan Lee',current_date+30)
on conflict do nothing;
insert into changes(id,code,prefix_id,address,name,owner,review_due,requester,reason,due) values
 ('40000000-0000-4000-8000-000000000001','CHG-DEMO','20000000-0000-4000-8000-000000000002','10.20.1.6/29','New label printer','Morgan Lee',current_date+60,'Alex Chen','Add the receiving desk printer',current_date-1)
on conflict do nothing;
insert into actions(id,namespace_id,title,owner,due) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Confirm scanner subnet with site lead','Alex Chen',current_date-3)
on conflict do nothing;
