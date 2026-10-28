# n8n-nodes-scraper-agent

A custom n8n community node that wraps a web scraping service. It pre-configures
the HTTP request to your microservice so you can drop it into a workflow and
scrape a URL in a single node.

## What it does

The node sends a `GET` request to:

```
https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/web/scrape
```

with the following query parameters:

| Parameter | Source | Default |
|-----------|--------|---------|
| `url` | User-provided URL to scrape | — |
| `response` | Output format | `markdown` |

And an optional `Authorization: Bearer <token>` header when a **Bearer Auth**
credential is attached. The request timeout defaults to 300000 ms (5 minutes)
and is configurable.

## Installation

```bash
cd /path/to/your/n8n/custom-nodes
npm install /path/to/n8n-nodes-scraper-agent
```

Restart n8n. The **Scraper Agent** node appears in the node panel under
"Transform".

## Usage

1. Add the **Scraper Agent** node to a workflow.
2. Enter the **URL** you want to scrape.
3. Optionally pick a **Response Format** (Markdown, HTML, Text, JSON).
4. If your service requires authentication, attach a **Bearer Auth** credential
   and set the token.
5. Run the node. The scraped content is returned on the `main` output.

## Development

```bash
npm install
npm run build
npm run dev
```

`npm run dev` watches for changes and rebuilds, so you can reload the node in a
running n8n instance.