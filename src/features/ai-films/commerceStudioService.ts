import { supabase } from '@/integrations/supabase/client';

export type CommerceFormat = 'ugc' | 'money_shot' | 'virtual_try_on' | 'tvc' | 'problem_solution' | 'before_after' | 'unboxing' | 'tutorial' | 'feature_highlight';
export type CommercePlatform = 'tiktok' | 'instagram_reels' | 'meta_feed' | 'youtube_shorts' | 'youtube' | 'connected_tv';

export type CampaignPlanInput = {
  product: {
    name: string;
    description: string;
    audience: string;
    selling_points: string[];
    product_image_url?: string;
    offer?: string;
  };
  brand: {
    name: string;
    voice: string;
    colors: string[];
    required_phrases: string[];
    prohibited_phrases: string[];
    logo_url?: string;
  };
  formats: CommerceFormat[];
  platforms: CommercePlatform[];
  variants_per_platform: number;
  index_with_jockey: boolean;
};

export type CampaignVariant = {
  id: string;
  platform: CommercePlatform;
  format: CommerceFormat;
  variant: number;
  aspect_ratio: string;
  duration_seconds: number;
  selling_point: string;
  beats: string[];
  prompt: string;
  provider_route: { provider: string; model: string; fallback: string };
  jockey_index_after_render: boolean;
};

export type CampaignPlan = {
  product: string;
  brand: string;
  status: string;
  variant_count: number;
  credit_spend: boolean;
  variants: CampaignVariant[];
};

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function authorizationHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to plan or generate a commerce campaign.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function planCommerceCampaign(input: CampaignPlanInput): Promise<CampaignPlan> {
  const response = await fetch(`${apiBase}/api/ai-films/commerce/campaigns/plan`, {
    method: 'POST',
    headers: await authorizationHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Commerce campaign planning failed.');
  }
  return response.json();
}
