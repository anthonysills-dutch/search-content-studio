# Search Content Studio

Research the pages that rank for a query, write and score content for search engines and AI answers, audit your sites, and track whether AI assistants mention your brand.

Inspired by https://frase.io

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Register your sites with their domain, brand name, language and country.
- Build research briefs from the top results for a query: titles, lengths, outlines, topic terms, gaps and questions, then an editable outline.
- Write in a Markdown editor with live SEO and GEO scores, next changes and missing terms; export as Markdown or HTML.
- Ask AI for an outline, a draft, an expanded section or a rewrite in your voice, and accept or discard each proposal.
- Keep voice profiles with tone, audience, samples, preferred and banned words, and assign them to sites and documents.
- Run background site audits with a health score, issues ranked by impact and a history of past audits.
- Track the questions buyers ask AI assistants and see daily whether answers mention or cite your site.

Left out: accounts and sign-in, which your Gateway handles; plans and billing; CMS publishing; agents, API and MCP server; rank tracking; and long-tail extras such as calendars, widgets and client reports.

## Setup

```sh
pnpm install
pnpm dev          # local, behind the dev Gateway
pnpm test         # unit tests
pnpm run deploy   # to your Cloudflare account, behind your Gateway
```

The release checks in `checks/` run against a packaged build with the controller's runtime.

Nothing is required to open the app. Two optional features turn on more:

- **Search data** (`dataforseo` capability): briefs fetch the top results and questions for a query. Without it, paste the result URLs.
- **AI drafting and visibility** (`openrouter` provider): drafting actions in the editor and AI visibility checks. Without it, both show as unavailable.

Admins set the pages per audit, the models asked for AI visibility and the drafting model on the Settings page.

## Limitations

- Each member's sites, briefs, documents and voice profiles are private to them; nothing is shared between members.
- An audit fetches every page within one queue run, so large page caps need a Workers plan with enough subrequests.
- Search data, AI drafting and AI visibility were tested against local stand-ins, not the live services.
