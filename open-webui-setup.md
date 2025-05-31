# Open WebUI Setup

## Running
Open WebUI is running at: http://localhost:3000

## Docker Commands
- Start: `docker start open-webui`
- Stop: `docker stop open-webui`
- Logs: `docker logs open-webui`
- Remove: `docker rm open-webui`

## Provider Configuration Notes

### Your Current Providers from Morphic:
- OpenAI (OPENAI_API_KEY)
- Anthropic (ANTHROPIC_API_KEY) 
- Google (GOOGLE_GENERATIVE_AI_API_KEY)
- Groq (GROQ_API_KEY)
- DeepSeek (DEEPSEEK_API_KEY)
- Fireworks (FIREWORKS_API_KEY)
- xAI (XAI_API_KEY)
- OpenRouter (OPENROUTER_API_KEY, OPENROUTER_BASE_URL)
- RITS (IBM_RITS_API_KEY, IBM_RITS_API_BASE_URL)

### Next Steps:
1. Go to http://localhost:3000
2. Create admin account
3. Configure providers in Admin Panel -> Settings -> Connections
4. Test with your models