# MCP Authorization Configuration

## Current Status

### Issues Found:
1. ❌ **n8n Authorization** - Had a URL instead of a token in the Authorization header
2. ⚠️ **Neon MCP** - May need API key if authentication is required

## Fixed Configuration

The `mcp.json` file has been updated with proper headers:

```json
{
  "mcpServers": {
    "Neon": {
      "url": "https://mcp.neon.tech/mcp",
      "headers": {
        "Content-Type": "application/json"
      }
    },
    "n8n": {
      "url": "http://localhost:8080/mcp",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}
```

## Authorization Requirements

### Neon MCP Server

**Current Setup:**
- URL: `https://mcp.neon.tech/mcp`
- Headers: Content-Type only

**If Authentication is Required:**

1. **Get Neon API Key:**
   - Go to [Neon Console](https://console.neon.tech)
   - Navigate to **Settings** → **API Keys**
   - Create a new API key
   - Copy the key

2. **Update MCP Config:**
   ```json
   {
     "mcpServers": {
       "Neon": {
         "url": "https://mcp.neon.tech/mcp",
         "headers": {
           "Content-Type": "application/json",
           "Authorization": "Bearer YOUR_NEON_API_KEY_HERE"
         }
       }
     }
   }
   ```

**Note:** Some MCP servers may use connection strings instead. Check Neon MCP documentation.

### n8n MCP Server

**Current Setup:**
- URL: `http://localhost:8080/mcp` (local server)
- Headers: Content-Type only

**If Authentication is Required:**

1. **Get n8n API Key:**
   - In n8n, go to **Settings** → **API**
   - Generate an API key
   - Copy the key

2. **Update MCP Config:**
   ```json
   {
     "mcpServers": {
       "n8n": {
         "url": "http://localhost:8080/mcp",
         "headers": {
           "Content-Type": "application/json",
           "Authorization": "Bearer YOUR_N8N_API_KEY_HERE"
         }
       }
     }
   }
   ```

## Testing Authorization

### Test Neon MCP:
1. Restart Cursor to reload MCP config
2. Try using Neon MCP features
3. Check Cursor logs for authentication errors

### Test n8n MCP:
1. Ensure n8n is running on `localhost:8080`
2. Restart Cursor
3. Try using n8n MCP features
4. Check n8n logs for connection attempts

## Common Issues

### Issue: "Unauthorized" or "401" errors
**Solution:** Add API key to Authorization header

### Issue: "Connection refused"
**Solution:** 
- For n8n: Ensure n8n server is running
- For Neon: Check if MCP server URL is correct

### Issue: "Invalid token"
**Solution:** 
- Regenerate API key
- Ensure token format is: `Bearer YOUR_TOKEN_HERE`

## Next Steps

1. ✅ **Fixed** - Removed incorrect URL from n8n Authorization
2. ⚠️ **Monitor** - Check if Neon MCP requires API key
3. ⚠️ **Test** - Restart Cursor and test MCP connections
4. ⚠️ **Add Keys** - If authentication errors occur, add API keys

## Security Notes

- Never commit `mcp.json` with API keys to git
- Use environment variables for sensitive tokens if possible
- Rotate API keys periodically
- Use least-privilege access for API keys


