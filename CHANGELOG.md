# Changelog

## 2.0.0

- Added `/api/summarize` Vercel serverless endpoint for secure OpenAI summarization.
- Removed browser-side OpenAI API key storage and direct OpenAI API calls.
- Added server-side summary caching with optional Upstash Redis persistence.
- Added simple server-side request rate limiting for summary generation.
- Rendered PubMed and AI-generated content with DOM text nodes instead of unsafe HTML interpolation.
- Updated the settings panel to show AI summary service status.
- Refreshed the app color palette and bumped the PWA cache version.
