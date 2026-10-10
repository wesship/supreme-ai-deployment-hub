-- Agent Templates (marketplace catalog)
CREATE TABLE public.agent_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Capabilities & Requirements
  capabilities JSONB DEFAULT '[]',
  required_integrations TEXT[] DEFAULT '{}',
  mcp_tools TEXT[] DEFAULT '{}',
  
  -- Pricing
  pricing_model TEXT NOT NULL DEFAULT 'free',
  price NUMERIC DEFAULT 0,
  
  -- Stats
  downloads INTEGER DEFAULT 0,
  avg_rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  
  -- Template definition
  config_schema JSONB DEFAULT '{}',
  default_config JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deployed Agents (user instances)
CREATE TABLE public.deployed_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.agent_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  
  -- Configuration
  config JSONB DEFAULT '{}',
  mcp_config JSONB DEFAULT '{"gateway_url": null, "enabled_tools": []}',
  
  -- Status & Metrics
  status TEXT NOT NULL DEFAULT 'stopped',
  health_score NUMERIC DEFAULT 100,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  
  -- Resource usage
  cpu_usage NUMERIC DEFAULT 0,
  memory_usage NUMERIC DEFAULT 0,
  
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent Reviews
CREATE TABLE public.agent_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.agent_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(template_id, user_id)
);

-- Enable RLS
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployed_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reviews ENABLE ROW LEVEL SECURITY;

-- Agent Templates Policies
CREATE POLICY "Anyone can view published templates"
  ON public.agent_templates FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authors can view own templates"
  ON public.agent_templates FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "Users can create templates"
  ON public.agent_templates FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own templates"
  ON public.agent_templates FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own templates"
  ON public.agent_templates FOR DELETE
  USING (auth.uid() = author_id);

-- Deployed Agents Policies
CREATE POLICY "Users can view own deployed agents"
  ON public.deployed_agents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can deploy agents"
  ON public.deployed_agents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployed agents"
  ON public.deployed_agents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deployed agents"
  ON public.deployed_agents FOR DELETE
  USING (auth.uid() = user_id);

-- Agent Reviews Policies
CREATE POLICY "Anyone can view reviews"
  ON public.agent_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews"
  ON public.agent_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.agent_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.agent_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_agent_templates_category ON public.agent_templates(category);
CREATE INDEX idx_agent_templates_status ON public.agent_templates(status);
CREATE INDEX idx_agent_templates_author ON public.agent_templates(author_id);
CREATE INDEX idx_deployed_agents_user ON public.deployed_agents(user_id);
CREATE INDEX idx_deployed_agents_status ON public.deployed_agents(status);
CREATE INDEX idx_agent_reviews_template ON public.agent_reviews(template_id);

-- Trigger for updated_at
CREATE TRIGGER update_agent_templates_updated_at
  BEFORE UPDATE ON public.agent_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deployed_agents_updated_at
  BEFORE UPDATE ON public.deployed_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();