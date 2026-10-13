# Module 13 Completion Report

## MCP Configuration
File: `.mcp.json` (portable format; `mcpServers` key)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "atlassian": {
      "type": "http",
      "url": "https://mcp.atlassian.com/v2/mcp"
    }
  }
}
```

## Configured Servers
- github
- atlassian

## MCP Tool Test
The configured remote endpoints were contacted with MCP `initialize` requests.
Both require an authenticated OAuth session; no server tool call could run
from this terminal.

- Configured server: `github` (`https://api.githubcopilot.com/mcp/`)
- Result: initialization rejected; no access token provided.
- Raw response:
```text
HTTP/2 401
content-type: text/plain; charset=utf-8
www-authenticate: ******"invalid_request", error_description="No access token was provided in this request", resource_metadata="https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp/"
bad request: missing required Authorization header
```

- Configured server: `atlassian` (`https://mcp.atlassian.com/v2/mcp`)
- Result: initialization rejected; endpoint reported an invalid token.
- Raw response:
```text
HTTP/2 401
www-authenticate: ******"https://mcp.atlassian.com/.well-known/oauth-protected-resource/v2/mcp"
{"error":"invalid_token"}
```

These are live endpoint responses, not successful tool tests. Complete or
refresh OAuth authorization for each server in VS Code, then invoke a tool
from a configured server to complete the tool-test criterion.
