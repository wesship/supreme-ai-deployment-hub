-- Agent OS service-role least-privilege hardening.
-- Keep backend CRUD access while removing table privileges not required by the control plane.

revoke truncate, references, trigger on table public.agent_os_workspace_policies from service_role;
revoke truncate, references, trigger on table public.agent_os_approvals from service_role;
