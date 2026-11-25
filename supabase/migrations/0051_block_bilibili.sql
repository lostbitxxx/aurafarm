-- Add Bilibili to the desktop pet blocklist. Subdomains match the host.
-- Run this after 0050_dev_finish_desktop_session.sql. Safe to run again.

insert into public.blocklist_hosts (host, label)
values ('bilibili.com', 'Bilibili')
on conflict (host) do nothing;
