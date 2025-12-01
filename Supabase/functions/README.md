# Supabase Edge Functions - Environment Variables

This file documents the environment variables needed for the Edge Functions.

## Local Development

Create a `.env.local` file in the `Supabase/functions` directory:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

## Production Deployment

Set secrets using Supabase CLI:

```bash
# Set GROQ API Key
supabase secrets set GROQ_API_KEY=your_groq_api_key_here

# Verify secrets
supabase secrets list
```

## Deployment Commands

```bash
# Link to your Supabase project (first time only)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the Edge Function
supabase functions deploy generate-quiz

# Test the deployed function
curl -L -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-quiz' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  --data '{"category":"Science","difficulty":"Easy"}'
```
