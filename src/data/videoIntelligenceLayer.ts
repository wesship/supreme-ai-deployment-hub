import { AgentTemplate } from '@/types/marketplace';

export type VideoStartupRecord = {
  company: string;
  website: string;
  foundedYear?: number;
  headquarters: string;
  tagline: string;
  totalFundingUsd: number;
  valuationUsd: number;
  fundingLabel: string;
  valuationLabel: string;
  latestRound: string;
  category: string;
  targetMarket: string;
  keyProducts: string[];
  investors: string[];
  founders: string[];
};

export const videoStartupRecords: VideoStartupRecord[] = [
  {
    "company": "MiniMax",
    "website": "https://minimaxi.com",
    "foundedYear": 2021,
    "headquarters": "Shanghai, China",
    "tagline": "Intelligence with Everyone",
    "totalFundingUsd": 1150000000,
    "valuationUsd": 12800000000,
    "fundingLabel": "$1.1B",
    "valuationLabel": "$12.8B",
    "latestRound": "",
    "category": "GenAI video / creative AI",
    "targetMarket": "Global consumers, enterprise developers, creators, and media teams across text, audio, video, and music applications.",
    "keyProducts": ["MiniMax M1", "Hailuo Video", "Hailuo-02", "MiniMax Speech 02", "MiniMax Music 01", "MiniMax Agent"],
    "investors": ["MiHoYo", "Alibaba", "Tencent", "Hillhouse Investment", "HongShan", "IDG Capital"],
    "founders": ["Yan Junjie", "Yun Yeyi", "Yang Bin", "Zhou Yucong"]
  },
  {
    "company": "Luma AI",
    "website": "https://lumalabs.ai",
    "foundedYear": 2021,
    "headquarters": "Palo Alto, California",
    "tagline": "Dream Machine - generate realistic videos from text",
    "totalFundingUsd": 1000000000,
    "valuationUsd": 4000000000,
    "fundingLabel": "$1.0B",
    "valuationLabel": "$4.0B",
    "latestRound": "",
    "category": "GenAI video / world models",
    "targetMarket": "Filmmaking, gaming, advertising, design, studios, brands, creators, and embedded creative products.",
    "keyProducts": ["Dream Machine", "Ray3", "Photon", "Genie", "World Models", "NeRF / Gaussian Splatting tooling"],
    "investors": ["HUMAIN", "AMD Ventures", "Amazon", "Andreessen Horowitz", "Amplify Partners", "Matrix Partners", "NVIDIA Ventures"],
    "founders": ["Amit Jain", "Alex Yu", "Alberto Taiuti"]
  },
  {
    "company": "Runway",
    "website": "https://runwayml.com",
    "foundedYear": 2018,
    "headquarters": "New York, NY",
    "tagline": "Advancing creativity with AI",
    "totalFundingUsd": 544500000,
    "valuationUsd": 3000000000,
    "fundingLabel": "$545M",
    "valuationLabel": "$3.0B",
    "latestRound": "Series D",
    "category": "GenAI video / creative suite",
    "targetMarket": "Professional creators, studios, agencies, filmmakers, media teams, and enterprise creative teams.",
    "keyProducts": ["Gen-3 Alpha", "Gen-2", "Act-One", "Runway Studios", "AI video editing tools"],
    "investors": ["Google", "NVIDIA", "Salesforce Ventures", "Felicis", "Amplify Partners", "Lux Capital"],
    "founders": ["Cristóbal Valenzuela", "Anastasis Germanidis", "Alejandro Matamala"]
  },
  {
    "company": "Synthesia",
    "website": "https://synthesia.io",
    "foundedYear": 2017,
    "headquarters": "London, United Kingdom",
    "tagline": "AI video communications platform",
    "totalFundingUsd": 536000000,
    "valuationUsd": 4000000000,
    "fundingLabel": "$536M",
    "valuationLabel": "$4.0B",
    "latestRound": "Series D",
    "category": "AI avatars / enterprise video",
    "targetMarket": "Enterprise training, internal communications, localization, customer education, and video operations.",
    "keyProducts": ["AI Avatars", "AI Video Generator", "Dubbing", "Enterprise video platform"],
    "investors": ["NEA", "Accel", "Kleiner Perkins", "GV", "NVIDIA", "FirstMark"],
    "founders": ["Victor Riparbelli", "Steffen Tjerrild", "Lourdes Agapito", "Matthias Niessner"]
  },
  {
    "company": "Hugging Face",
    "website": "https://huggingface.co",
    "foundedYear": 2016,
    "headquarters": "New York, NY",
    "tagline": "The AI community building the future",
    "totalFundingUsd": 395000000,
    "valuationUsd": 4500000000,
    "fundingLabel": "$395M",
    "valuationLabel": "$4.5B",
    "latestRound": "Series D",
    "category": "Open AI platform / model hub",
    "targetMarket": "Developers, AI researchers, enterprises, model builders, and open-source AI teams.",
    "keyProducts": ["Model Hub", "Spaces", "Datasets", "Transformers", "Inference Endpoints"],
    "investors": ["Salesforce", "Google", "Amazon", "NVIDIA", "Intel", "AMD", "IBM", "Qualcomm"],
    "founders": ["Clément Delangue", "Julien Chaumond", "Thomas Wolf"]
  },
  {
    "company": "Suno",
    "website": "https://suno.com",
    "foundedYear": 2022,
    "headquarters": "Cambridge, Massachusetts",
    "tagline": "Make any song you can imagine",
    "totalFundingUsd": 375000000,
    "valuationUsd": 2450000000,
    "fundingLabel": "$375M",
    "valuationLabel": "$2.5B",
    "latestRound": "Series C",
    "category": "AI music / audio for video",
    "targetMarket": "Creators, musicians, marketers, social video teams, and entertainment workflows.",
    "keyProducts": ["AI Music Generator", "Suno v4", "Song generation API"],
    "investors": ["Lightspeed", "Matrix", "Nat Friedman", "Daniel Gross"],
    "founders": ["Mikey Shulman", "Georg Kucsko", "Keenan Freyberg", "Martin Camacho"]
  },
  {
    "company": "Lightricks",
    "website": "https://www.lightricks.com",
    "foundedYear": 2013,
    "headquarters": "Jerusalem, Israel",
    "tagline": "Creative tools for content creators",
    "totalFundingUsd": 335000000,
    "valuationUsd": 1800000000,
    "fundingLabel": "$335M",
    "valuationLabel": "$1.8B",
    "latestRound": "Series D",
    "category": "Creative AI apps / video editing",
    "targetMarket": "Mobile creators, influencers, social teams, marketers, and creative professionals.",
    "keyProducts": ["Videoleap", "Facetune", "Photoleap", "LTX Studio"],
    "investors": ["Insight Partners", "Goldman Sachs", "ClalTech", "Greenspring Associates"],
    "founders": ["Zeev Farbman", "Amit Goldstein", "Yaron Inger", "Itai Tsiddon"]
  },
  {
    "company": "Writer",
    "website": "https://writer.com",
    "foundedYear": 2020,
    "headquarters": "San Francisco, CA",
    "tagline": "Enterprise generative AI platform",
    "totalFundingUsd": 326000000,
    "valuationUsd": 2100000000,
    "fundingLabel": "$326M",
    "valuationLabel": "$2.1B",
    "latestRound": "Series C",
    "category": "Enterprise AI / content operations",
    "targetMarket": "Enterprise marketing, sales, support, governance, and content operations teams.",
    "keyProducts": ["Palmyra LLM", "Knowledge Graph", "AI Studio", "Writer Framework"],
    "investors": ["ICONIQ Growth", "WndrCo", "Insight Partners", "Balderton", "Salesforce Ventures"],
    "founders": ["May Habib", "Waseem AlShikh"]
  },
  {
    "company": "Captions",
    "website": "https://www.captions.ai",
    "foundedYear": 2021,
    "headquarters": "New York, NY",
    "tagline": "The AI-powered creative studio",
    "totalFundingUsd": 100000000,
    "valuationUsd": 500000000,
    "fundingLabel": "$100M",
    "valuationLabel": "$500M",
    "latestRound": "Series C",
    "category": "Creator video tools",
    "targetMarket": "Short-form creators, marketers, educators, founders, and small businesses.",
    "keyProducts": ["AI Creator", "AI Edit", "AI Shorts", "Captions mobile app"],
    "investors": ["Kleiner Perkins", "Sequoia Capital", "Andreessen Horowitz", "Adobe Ventures"],
    "founders": ["Gaurav Misra", "Dwight Churchill"]
  },
  {
    "company": "ElevenLabs",
    "website": "https://elevenlabs.io",
    "foundedYear": 2022,
    "headquarters": "New York, NY",
    "tagline": "Making content universally accessible in any language and voice",
    "totalFundingUsd": 101000000,
    "valuationUsd": 1100000000,
    "fundingLabel": "$101M",
    "valuationLabel": "$1.1B",
    "latestRound": "Series B",
    "category": "AI voice / dubbing for video",
    "targetMarket": "Video creators, game studios, localization teams, publishers, marketers, and enterprises.",
    "keyProducts": ["Text to Speech", "Voice Cloning", "Dubbing Studio", "Voice Library"],
    "investors": ["Andreessen Horowitz", "Sequoia Capital", "SV Angel", "Nat Friedman", "Daniel Gross"],
    "founders": ["Mati Staniszewski", "Piotr Dabkowski"]
  },
  {
    "company": "HeyGen",
    "website": "https://www.heygen.com",
    "foundedYear": 2020,
    "headquarters": "Los Angeles, CA",
    "tagline": "AI video generator for business",
    "totalFundingUsd": 74000000,
    "valuationUsd": 500000000,
    "fundingLabel": "$74M",
    "valuationLabel": "$500M",
    "latestRound": "Series A",
    "category": "AI avatars / business video",
    "targetMarket": "Business video, sales, marketing, training, localization, and personalized customer communication.",
    "keyProducts": ["AI Avatars", "Video Translate", "Personalized Video", "Avatar API"],
    "investors": ["Benchmark", "Conviction", "Thrive Capital", "Bond"],
    "founders": ["Joshua Xu", "Wayne Liang"]
  },
  {
    "company": "Pika",
    "website": "https://pika.art",
    "foundedYear": 2023,
    "headquarters": "Palo Alto, CA",
    "tagline": "An idea-to-video platform",
    "totalFundingUsd": 55000000,
    "valuationUsd": 700000000,
    "fundingLabel": "$55M",
    "valuationLabel": "$700M",
    "latestRound": "Series A",
    "category": "Text-to-video / creative AI",
    "targetMarket": "Creators, social teams, artists, marketers, meme creators, and video storytellers.",
    "keyProducts": ["Pika 1.0", "Pikaffects", "Text-to-video", "Image-to-video"],
    "investors": ["Lightspeed", "Greylock", "Homebrew", "Conviction", "SV Angel"],
    "founders": ["Demi Guo", "Chenlin Meng"]
  },
  {
    "company": "Jasper",
    "website": "https://jasper.ai",
    "foundedYear": 2021,
    "headquarters": "Austin, Texas",
    "tagline": "AI platform purpose-built for better marketing outputs and outcomes",
    "totalFundingUsd": 131000000,
    "valuationUsd": 1500000000,
    "fundingLabel": "$131M",
    "valuationLabel": "$1.5B",
    "latestRound": "Series A",
    "category": "AI marketing / content operations",
    "targetMarket": "Marketing teams, content teams, brand teams, and agencies.",
    "keyProducts": ["Jasper Campaigns", "Brand Voice", "AI marketing platform", "Content generation workflows"],
    "investors": ["Insight Partners", "Bessemer Venture Partners", "Coatue", "Foundation Capital"],
    "founders": ["Dave Rogenmoser", "J.P. Morgan", "Chris Hull"]
  },
  {
    "company": "Descript",
    "website": "https://www.descript.com",
    "foundedYear": 2017,
    "headquarters": "San Francisco, CA",
    "tagline": "Edit audio and video like a doc",
    "totalFundingUsd": 100000000,
    "valuationUsd": 550000000,
    "fundingLabel": "$100M",
    "valuationLabel": "$550M",
    "latestRound": "Series C",
    "category": "AI video/audio editing",
    "targetMarket": "Podcasters, creators, educators, marketers, agencies, and video teams.",
    "keyProducts": ["Text-based video editing", "Overdub", "Studio Sound", "Screen recording"],
    "investors": ["OpenAI Startup Fund", "Andreessen Horowitz", "Spark Capital", "Redpoint"],
    "founders": ["Andrew Mason"]
  }
];

export const videoIntelligenceSummary = {
  datasetName: 'GenAI Video Startup Competitive Intelligence',
  sourceArtifact: 'OKComputer_GenAI_Video_Startup_Report.zip',
  companyCount: videoStartupRecords.length,
  totalFundingUsd: videoStartupRecords.reduce((sum, company) => sum + company.totalFundingUsd, 0),
  totalValuationUsd: videoStartupRecords.reduce((sum, company) => sum + company.valuationUsd, 0),
  topFundedCompanies: videoStartupRecords
    .slice()
    .sort((a, b) => b.totalFundingUsd - a.totalFundingUsd)
    .slice(0, 10)
    .map((company) => company.company),
  marketUseCases: [
    'OpenMontage competitive positioning',
    'AI video product strategy',
    'Founder and investor research',
    'Video agent marketplace planning',
    'Funding and valuation analysis',
    'Product gap discovery'
  ],
};

export const videoProductionAgentTemplates: AgentTemplate[] = [
  {
    id: 'agent-video-001',
    name: 'OpenMontage Video Intelligence Studio',
    slug: 'openmontage-video-intelligence-studio',
    description: 'Agentic video production and GenAI video market intelligence for scripts, storyboards, competitor scans, and render-ready campaigns.',
    longDescription: `OpenMontage Video Intelligence Studio is the D3VONN.IO video production and market-intelligence agent.

Capabilities:
- Converts a topic into script, storyboard, narration plan, captions, and render checklist
- Positions OpenMontage against funded GenAI video startups
- Uses the Video Intelligence Layer dataset for competitor, founder, investor, funding, and product-gap analysis
- Routes production jobs into Hermes-style stages: research, script, storyboard, assets, narration, render, review, publish
- Produces social-ready briefs for Shorts, Reels, YouTube, product demos, ads, and launch trailers`,
    category: 'automation',
    capabilities: ['integration', 'scheduling', 'monitoring', 'reporting', 'ml-powered'],
    pricing: { model: 'subscription', amount: 149, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'devonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 13
    },
    status: 'published',
    version: '1.0.0',
    icon: '🎬',
    tags: ['openmontage', 'video-ai', 'storybook', 'competitive-intelligence', 'rendering', 'market-research'],
    requirements: ['OpenMontage workspace', 'FFmpeg', 'Configured media providers or stock media sources'],
    integrations: ['OpenMontage', 'Hermes', 'Pexels', 'Pixabay', 'YouTube', 'TikTok', 'Instagram'],
    stats: {
      downloads: 0,
      activeInstalls: 0,
      avgRating: 5.0,
      reviewCount: 0,
      lastUpdated: '2026-06-26'
    },
    createdAt: '2026-06-26',
    updatedAt: '2026-06-26',
    featured: true
  },
  {
    id: 'agent-video-002',
    name: 'Video Startup Analyst',
    slug: 'video-startup-analyst',
    description: 'Analyzes GenAI video startups, funding rounds, valuation signals, investors, founders, product categories, and D3VONN market gaps.',
    longDescription: `Video Startup Analyst turns the uploaded GenAI video startup dataset into a strategic research layer.

Use it to answer:
- Which video AI companies are most heavily funded?
- Which products compete with OpenMontage or D3VONN.IO video agents?
- Which investors repeatedly back the category?
- Which startup categories show gaps D3VONN.IO can enter?
- Which companies should be watched, partnered with, cloned, or avoided?`,
    category: 'analytics',
    capabilities: ['reporting', 'monitoring', 'ml-powered', 'scheduling'],
    pricing: { model: 'subscription', amount: 99, currency: 'USD', interval: 'monthly' },
    author: {
      id: 'devonn',
      name: 'D3VONN.IO',
      verified: true,
      agentCount: 13
    },
    status: 'published',
    version: '1.0.0',
    icon: '📈',
    tags: ['genai-video', 'startup-research', 'funding', 'valuation', 'investors', 'strategy'],
    integrations: ['Hermes', 'Storybook', 'CSV', 'Excel', 'Web Research'],
    stats: {
      downloads: 0,
      activeInstalls: 0,
      avgRating: 5.0,
      reviewCount: 0,
      lastUpdated: '2026-06-26'
    },
    createdAt: '2026-06-26',
    updatedAt: '2026-06-26',
    featured: true
  }
];
