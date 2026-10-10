-- Add restrictive policies to prevent any UPDATE or DELETE on agent_earnings (financial integrity)
CREATE POLICY "Block all updates to earnings"
ON public.agent_earnings
AS RESTRICTIVE
FOR UPDATE
USING (false);

CREATE POLICY "Block all deletes of earnings"
ON public.agent_earnings
AS RESTRICTIVE
FOR DELETE
USING (false);