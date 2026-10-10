-- Create agents table to track money-making agents
CREATE TABLE public.money_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'error')),
  total_earned DECIMAL(10,2) DEFAULT 0.00,
  runs_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create earnings table to track individual earnings
CREATE TABLE public.agent_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.money_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  earned_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_money_agents_user_id ON public.money_agents(user_id);
CREATE INDEX idx_money_agents_status ON public.money_agents(status);
CREATE INDEX idx_agent_earnings_user_id ON public.agent_earnings(user_id);
CREATE INDEX idx_agent_earnings_agent_id ON public.agent_earnings(agent_id);
CREATE INDEX idx_agent_earnings_earned_at ON public.agent_earnings(earned_at DESC);

-- Enable RLS
ALTER TABLE public.money_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for money_agents
CREATE POLICY "Users can view their own agents"
  ON public.money_agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agents"
  ON public.money_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents"
  ON public.money_agents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents"
  ON public.money_agents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for agent_earnings
CREATE POLICY "Users can view their own earnings"
  ON public.agent_earnings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own earnings"
  ON public.agent_earnings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for earnings
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_earnings;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for money_agents
CREATE TRIGGER update_money_agents_updated_at
  BEFORE UPDATE ON public.money_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();