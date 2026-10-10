drop function if exists public.marketplace_install_agent(text, text, jsonb, jsonb);
drop function if exists public.marketplace_uninstall_agent(uuid);
drop function if exists public.marketplace_update_installation_status(uuid, text, text);