import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { rateLimit, rateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

// Pre-auth limiter (IP-keyed) — cheap shield against unauthenticated floods.
const RL_PRE_AUTH = { capacity: 20, refillPerSec: 20 / 60 };
// Post-auth limiter (user-keyed) — encryption ops are expensive.
const RL_POST_AUTH = { capacity: 15, refillPerSec: 15 / 60 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const preRl = rateLimit(rateLimitKey(req), RL_PRE_AUTH);
  if (!preRl.allowed) return rateLimitResponse(preRl, corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");

    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY not configured");
    }

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client with user's JWT for RLS
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create service role client for encryption operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const postRl = rateLimit(rateLimitKey(req, user.id), RL_POST_AUTH);
    if (!postRl.allowed) return rateLimitResponse(postRl, corsHeaders);

    const { action, provider, credentials, region } = await req.json();

    if (action === "store") {
      // Encrypt credentials using the database function
      const { data: encryptedBytes, error: encryptError } = await supabaseAdmin.rpc(
        "encrypt_credentials",
        {
          credentials_json: credentials,
          encryption_key: encryptionKey,
        }
      );

      if (encryptError) {
        console.error("Encryption error:", encryptError);
        throw new Error("Failed to encrypt credentials");
      }

      // Convert encrypted bytes to base64 for storage
      const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBytes)));

      // Deactivate existing credentials for this provider
      await supabaseAdmin
        .from("cloud_credentials")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("provider", provider);

      // Store the encrypted credentials
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from("cloud_credentials")
        .insert([
          {
            user_id: user.id,
            provider: provider,
            credentials: encryptedBase64,
            region: region,
            is_active: true,
          },
        ])
        .select("id, created_at")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to store credentials");
      }

      return new Response(
        JSON.stringify({ success: true, id: insertedData.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "retrieve") {
      // Fetch the encrypted credentials
      const { data: credData, error: fetchError } = await supabaseAdmin
        .from("cloud_credentials")
        .select("credentials")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .eq("is_active", true)
        .single();

      if (fetchError || !credData) {
        throw new Error("No credentials found");
      }

      // Convert base64 back to bytes
      const encryptedBytes = Uint8Array.from(atob(credData.credentials), (c) => c.charCodeAt(0));

      // Decrypt using the database function
      const { data: decryptedData, error: decryptError } = await supabaseAdmin.rpc(
        "decrypt_credentials",
        {
          encrypted_data: encryptedBytes,
          encryption_key: encryptionKey,
        }
      );

      if (decryptError) {
        console.error("Decryption error:", decryptError);
        throw new Error("Failed to decrypt credentials");
      }

      return new Response(
        JSON.stringify({ success: true, credentials: decryptedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
