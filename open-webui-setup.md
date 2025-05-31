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

### RITS Configuration (Multiple Providers Approach):
In Admin Panel -> Settings -> Connections, add separate OpenAI API connections:

1. **Llama 3.3 70B (RITS)**
   - API Base URL: `YOUR_IBM_RITS_API_BASE_URL/llama-3-3-70b-instruct/v1`
   - API Key: `YOUR_IBM_RITS_API_KEY`
   - Custom Headers: `RITS_API_KEY: YOUR_IBM_RITS_API_KEY`

2. **Llama 4 Maverick (RITS)**
   - API Base URL: `YOUR_IBM_RITS_API_BASE_URL/llama-4-mvk-17b-128e-fp8/v1`
   - API Key: `YOUR_IBM_RITS_API_KEY`
   - Custom Headers: `RITS_API_KEY: YOUR_IBM_RITS_API_KEY`

3. **Llama 4 Scout (RITS)**
   - API Base URL: `YOUR_IBM_RITS_API_BASE_URL/llama-4-scout-17b-16e/v1`
   - API Key: `YOUR_IBM_RITS_API_KEY`
   - Custom Headers: `RITS_API_KEY: YOUR_IBM_RITS_API_KEY`

4. **Qwen 2.5 72B (RITS)**
   - API Base URL: `YOUR_IBM_RITS_API_BASE_URL/qwen2-5-72b-instruct/v1`
   - API Key: `YOUR_IBM_RITS_API_KEY`
   - Custom Headers: `RITS_API_KEY: YOUR_IBM_RITS_API_KEY`

Then add corresponding model IDs in Models section.

### Next Steps:
1. Go to http://localhost:3000
2. Create admin account
3. Configure providers in Admin Panel -> Settings -> Connections
4. Test with your models