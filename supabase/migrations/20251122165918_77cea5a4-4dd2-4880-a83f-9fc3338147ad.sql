-- Create table for storing cloud provider credentials
CREATE TABLE public.cloud_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp')),
  credentials BYTEA NOT NULL, -- Encrypted credentials
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.cloud_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own cloud credentials"
  ON public.cloud_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cloud credentials"
  ON public.cloud_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cloud credentials"
  ON public.cloud_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cloud credentials"
  ON public.cloud_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for deployment history
CREATE TABLE public.deployment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL,
  cluster_name TEXT,
  status TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own deployment logs"
  ON public.deployment_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deployment logs"
  ON public.deployment_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployment logs"
  ON public.deployment_logs
  FOR UPDATE
  USING (auth.uid() = user_id);