import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "search-content-studio",
  name: "Search Content Studio",
  description: "Research what ranks, write and score content for search and AI answers, audit your sites and track whether AI assistants mention your brand.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // One message per site audit or AI visibility run.
    queues: [{ name: "JOBS", consumer: { maxBatchSize: 1, maxRetries: 1 } }],
  },
  providers: [
    {
      id: "openrouter",
      why: "Drafts and rewrites content, and asks AI models the questions you track.",
      docs: "https://openrouter.ai/keys",
    },
  ],
  capabilities: {
    dataforseo: {
      access: "read",
      why: "Finds the top search results and the questions people ask for a query.",
      docs: "https://app.dataforseo.com/api-access",
    },
  },
  features: {
    "search-data": {
      name: "Search data",
      why: "Briefs start from the top search results and people's questions instead of pasted URLs.",
      steps: ["Create a DataForSEO account and copy its API login and password: https://app.dataforseo.com/api-access"],
      capabilities: ["dataforseo"],
    },
    "ai-writing": {
      name: "AI drafting and visibility",
      why: "Drafts in your voice and checks whether AI answers mention your brand.",
      steps: ["Create an OpenRouter key: https://openrouter.ai/keys"],
      providers: ["openrouter"],
    },
  },
});
