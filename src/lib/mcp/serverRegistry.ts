// MCP Server Registry - Predefined MCP server configurations

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  category: "hosting" | "development" | "ai" | "automation" | "data" | "cloud" | "custom";
  icon?: string;
  
  // Connection configuration
  type: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  gatewayUrl?: string;
  
  // Authentication
  auth?: {
    type: "api_token" | "oauth" | "basic" | "none";
    envVar?: string;
    description?: string;
  };
  
  // Environment variables template
  env?: Record<string, string>;
  
  // Documentation
  docsUrl?: string;
  setupInstructions?: string;
}

export interface McpServerConnection extends McpServerConfig {
  isConnected: boolean;
  apiToken?: string;
  lastConnected?: Date;
}

// Pre-configured MCP servers
export const MCP_SERVER_REGISTRY: McpServerConfig[] = [
  // === HOSTING ===
  {
    id: "hostinger",
    name: "Hostinger",
    description: "Manage domains, hosting, VPS, and DNS through Hostinger API",
    category: "hosting",
    type: "stdio",
    command: "npx",
    args: ["hostinger-api-mcp@latest"],
    auth: {
      type: "api_token",
      envVar: "API_TOKEN",
      description: "Enter your Hostinger API token (get it from hPanel → API section)",
    },
    env: {
      API_TOKEN: "",
    },
    docsUrl: "https://developers.hostinger.com",
    setupInstructions: "1. Log into Hostinger hPanel\n2. Go to API section\n3. Generate a new API token\n4. Paste the token below",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Deploy and manage Vercel projects, domains, and serverless functions",
    category: "hosting",
    type: "http",
    gatewayUrl: "https://api.vercel.com",
    auth: {
      type: "api_token",
      envVar: "VERCEL_TOKEN",
      description: "Vercel API Token from account settings",
    },
    docsUrl: "https://vercel.com/docs/rest-api",
    setupInstructions: "1. Go to Vercel Dashboard → Settings → Tokens\n2. Create a new token\n3. Paste the token below",
  },
  {
    id: "netlify",
    name: "Netlify",
    description: "Manage Netlify sites, deploys, and serverless functions",
    category: "hosting",
    type: "http",
    gatewayUrl: "https://api.netlify.com/api/v1",
    auth: {
      type: "api_token",
      envVar: "NETLIFY_TOKEN",
      description: "Netlify Personal Access Token",
    },
    docsUrl: "https://docs.netlify.com/api/get-started/",
  },

  // === CLOUD PROVIDERS ===
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Manage DNS, Workers, R2 storage, and CDN configurations",
    category: "cloud",
    type: "stdio",
    command: "npx",
    args: ["@anthropic/mcp-server-cloudflare"],
    auth: {
      type: "api_token",
      envVar: "CLOUDFLARE_API_TOKEN",
      description: "Cloudflare API Token with appropriate permissions",
    },
    docsUrl: "https://developers.cloudflare.com/api/",
    setupInstructions: "1. Go to Cloudflare Dashboard → My Profile → API Tokens\n2. Create a custom token with needed permissions\n3. Paste the token below",
  },
  {
    id: "aws",
    name: "AWS",
    description: "Interact with AWS services - S3, Lambda, EC2, and more",
    category: "cloud",
    type: "stdio",
    command: "npx",
    args: ["@anthropic/mcp-server-aws"],
    auth: {
      type: "api_token",
      envVar: "AWS_ACCESS_KEY_ID",
      description: "AWS Access Key ID and Secret (comma-separated)",
    },
    docsUrl: "https://docs.aws.amazon.com/",
    setupInstructions: "1. Go to AWS IAM → Users → Security credentials\n2. Create access key\n3. Enter as: ACCESS_KEY,SECRET_KEY",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    description: "Manage Droplets, Kubernetes, databases, and App Platform",
    category: "cloud",
    type: "http",
    gatewayUrl: "https://api.digitalocean.com/v2",
    auth: {
      type: "api_token",
      envVar: "DIGITALOCEAN_TOKEN",
      description: "DigitalOcean Personal Access Token",
    },
    docsUrl: "https://docs.digitalocean.com/reference/api/",
  },
  {
    id: "linode",
    name: "Linode (Akamai)",
    description: "Manage Linode instances, Kubernetes, and object storage",
    category: "cloud",
    type: "http",
    gatewayUrl: "https://api.linode.com/v4",
    auth: {
      type: "api_token",
      envVar: "LINODE_TOKEN",
      description: "Linode Personal Access Token",
    },
    docsUrl: "https://www.linode.com/docs/api/",
  },
  {
    id: "hetzner",
    name: "Hetzner Cloud",
    description: "Manage Hetzner Cloud servers, networks, and load balancers",
    category: "cloud",
    type: "http",
    gatewayUrl: "https://api.hetzner.cloud/v1",
    auth: {
      type: "api_token",
      envVar: "HETZNER_TOKEN",
      description: "Hetzner Cloud API Token",
    },
    docsUrl: "https://docs.hetzner.cloud/",
  },

  // === DEVELOPMENT ===
  {
    id: "docker-mcp-gateway",
    name: "Docker MCP Gateway",
    description: "Local Docker-based MCP gateway for bundled tools (DuckDuckGo, GitHub, Filesystem)",
    category: "development",
    type: "http",
    gatewayUrl: "http://localhost:8080/mcp",
    auth: {
      type: "none",
    },
    setupInstructions: "Run the Docker MCP Gateway container:\ndocker run -p 8080:8080 mcp-gateway",
  },
  {
    id: "github-mcp",
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and GitHub Actions",
    category: "development",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-github"],
    auth: {
      type: "api_token",
      envVar: "GITHUB_TOKEN",
      description: "GitHub Personal Access Token with repo permissions",
    },
    env: {
      GITHUB_TOKEN: "",
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Manage GitLab projects, merge requests, and CI/CD pipelines",
    category: "development",
    type: "http",
    gatewayUrl: "https://gitlab.com/api/v4",
    auth: {
      type: "api_token",
      envVar: "GITLAB_TOKEN",
      description: "GitLab Personal Access Token",
    },
    docsUrl: "https://docs.gitlab.com/ee/api/",
  },
  {
    id: "filesystem-mcp",
    name: "Filesystem",
    description: "Read and write files on the local filesystem",
    category: "development",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
    auth: {
      type: "none",
    },
    docsUrl: "https://github.com/modelcontextprotocol/servers",
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation for web scraping and testing",
    category: "development",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-puppeteer"],
    auth: {
      type: "none",
    },
    docsUrl: "https://pptr.dev/",
  },

  // === AI ===
  {
    id: "devonn-gateway",
    name: "D3VONN.IO Gateway",
    description: "Connect to D3VONN.IO's central MCP gateway for unified tool access",
    category: "ai",
    type: "http",
    gatewayUrl: "https://api.d3vonn.io/mcp",
    auth: {
      type: "api_token",
      envVar: "DEVONN_API_KEY",
      description: "D3VONN.IO API key from your dashboard",
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Access GPT models, DALL-E, Whisper, and embeddings",
    category: "ai",
    type: "http",
    gatewayUrl: "https://api.openai.com/v1",
    auth: {
      type: "api_token",
      envVar: "OPENAI_API_KEY",
      description: "OpenAI API Key",
    },
    docsUrl: "https://platform.openai.com/docs/api-reference",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Access Claude models for AI assistance",
    category: "ai",
    type: "http",
    gatewayUrl: "https://api.anthropic.com/v1",
    auth: {
      type: "api_token",
      envVar: "ANTHROPIC_API_KEY",
      description: "Anthropic API Key",
    },
    docsUrl: "https://docs.anthropic.com/",
  },

  // === AUTOMATION ===
  {
    id: "slack-mcp",
    name: "Slack",
    description: "Send messages, manage channels, and interact with Slack workspaces",
    category: "automation",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-slack"],
    auth: {
      type: "api_token",
      envVar: "SLACK_TOKEN",
      description: "Slack Bot Token (xoxb-...)",
    },
    env: {
      SLACK_TOKEN: "",
    },
    docsUrl: "https://api.slack.com/docs",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Manage Discord servers, channels, and send messages",
    category: "automation",
    type: "http",
    gatewayUrl: "https://discord.com/api/v10",
    auth: {
      type: "api_token",
      envVar: "DISCORD_TOKEN",
      description: "Discord Bot Token",
    },
    docsUrl: "https://discord.com/developers/docs",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Create and manage Notion pages, databases, and blocks",
    category: "automation",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-notion"],
    auth: {
      type: "api_token",
      envVar: "NOTION_TOKEN",
      description: "Notion Integration Token",
    },
    docsUrl: "https://developers.notion.com/",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Manage Linear issues, projects, and cycles",
    category: "automation",
    type: "http",
    gatewayUrl: "https://api.linear.app/graphql",
    auth: {
      type: "api_token",
      envVar: "LINEAR_API_KEY",
      description: "Linear API Key",
    },
    docsUrl: "https://developers.linear.app/docs",
  },

  // === DATA ===
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web search using Brave Search API",
    category: "data",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-brave-search"],
    auth: {
      type: "api_token",
      envVar: "BRAVE_API_KEY",
      description: "Brave Search API Key",
    },
    docsUrl: "https://brave.com/search/api/",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    category: "data",
    type: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-postgres"],
    auth: {
      type: "api_token",
      envVar: "DATABASE_URL",
      description: "PostgreSQL connection string",
    },
    docsUrl: "https://www.postgresql.org/docs/",
  },

  // === CUSTOM ===
  {
    id: "custom",
    name: "Custom Server",
    description: "Configure a custom MCP server endpoint",
    category: "custom",
    type: "http",
    gatewayUrl: "",
    auth: {
      type: "none",
    },
  },
];

// Get server by ID
export function getServerConfig(id: string): McpServerConfig | undefined {
  return MCP_SERVER_REGISTRY.find((s) => s.id === id);
}

// Get servers by category
export function getServersByCategory(category: McpServerConfig["category"]): McpServerConfig[] {
  return MCP_SERVER_REGISTRY.filter((s) => s.category === category);
}

// Category metadata
export const SERVER_CATEGORIES = {
  hosting: { label: "Hosting & Infrastructure", icon: "Server" },
  cloud: { label: "Cloud Providers", icon: "Cloud" },
  development: { label: "Development Tools", icon: "Code" },
  ai: { label: "AI & ML", icon: "Brain" },
  automation: { label: "Automation", icon: "Zap" },
  data: { label: "Data & Analytics", icon: "Database" },
  custom: { label: "Custom", icon: "Settings" },
} as const;
