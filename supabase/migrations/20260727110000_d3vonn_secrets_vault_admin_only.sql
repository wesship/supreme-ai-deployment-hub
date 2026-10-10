-- Align deployed D3VONN Secrets Vault policies with the admin-only initial release.
-- Delegated reader roles require a separate reviewed role migration and route guard.

DROP POLICY IF EXISTS "Secrets vault readers can view inventory" ON public.secret_inventory;
DROP POLICY IF EXISTS "Secrets vault admins can view inventory" ON public.secret_inventory;
CREATE POLICY "Secrets vault admins can view inventory"
    ON public.secret_inventory FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Secrets vault readers can view audit" ON public.secret_inventory_audit;
DROP POLICY IF EXISTS "Secrets vault admins can view audit" ON public.secret_inventory_audit;
CREATE POLICY "Secrets vault admins can view audit"
    ON public.secret_inventory_audit FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );
