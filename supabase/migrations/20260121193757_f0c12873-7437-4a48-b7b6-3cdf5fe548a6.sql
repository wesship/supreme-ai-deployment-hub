-- Create table for storing MCP server connections
CREATE TABLE public.mcp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  server_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  server_type TEXT NOT NULL CHECK (server_type IN ('stdio', 'http', 'sse')),
  gateway_url TEXT,
  category TEXT NOT NULL,
  api_token_encrypted TEXT,
  custom_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: one connection per server per user
  UNIQUE(user_id, server_id)
);

-- Enable Row Level Security
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own MCP connections" 
ON public.mcp_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own MCP connections" 
ON public.mcp_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MCP connections" 
ON public.mcp_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MCP connections" 
ON public.mcp_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mcp_connections_updated_at
BEFORE UPDATE ON public.mcp_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_mcp_connections_user_id ON public.mcp_connections(user_id);
CREATE INDEX idx_mcp_connections_server_id ON public.mcp_connections(server_id);