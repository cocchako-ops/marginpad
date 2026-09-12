# Trade on paper from Claude Desktop, ChatGPT or Cursor (MCP)

MarginPad runs a remote MCP server with 27 tools (prices, candles, screener, liquidations, the full paper-trading account, books, reset, the equity curve and a replay of any past day).

Claude Desktop `claude_desktop_config.json`:

```json
{ "mcpServers": { "marginpad": { "url": "https://marginpad.io/mcp", "headers": { "X-API-Key": "mpb_..." } } } }
```

Cursor `.cursor/mcp.json`: the same block. Without a key the market-data tools work; the trading tools need one (free at https://marginpad.io/trading-api/).

Then ask: "Open a BTC long with $100 at 10x and a 2% trailing stop, and tell me when it closes."
