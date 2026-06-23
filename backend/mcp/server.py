import json
from typing import Any

from mcp.server import Server
from mcp.types import TextContent, Tool

from backend.mcp.integrations import CONNECTORS


mcp = Server("cto-dash-mcp")


@mcp.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="health_check",
            description="Check health of all configured data-source connectors",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="sync_source",
            description="Sync metrics and events from a source (github, jira, observability)",
            inputSchema={
                "type": "object",
                "properties": {"source": {"type": "string", "enum": list(CONNECTORS.keys())}},
                "required": ["source"],
            },
        ),
        Tool(
            name="get_metrics",
            description="Get stored metrics, optionally filtered by source or metric_type",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "metric_type": {"type": "string"},
                },
            },
        ),
    ]


@mcp.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "health_check":
        results = {}
        for key, cls in CONNECTORS.items():
            results[key] = await cls().health_check()
        return [TextContent(type="text", text=json.dumps(results, indent=2))]

    if name == "sync_source":
        source = arguments.get("source")
        if source not in CONNECTORS:
            return [TextContent(type="text", text=json.dumps({"error": f"Unknown source: {source}"}))]
        conn = CONNECTORS[source]()
        metrics = await conn.fetch_metrics()
        events = await conn.fetch_events()
        return [TextContent(type="text", text=json.dumps({"metrics": len(metrics), "events": len(events)}, indent=2))]

    if name == "get_metrics":
        # This MCP tool returns normalized connector output for now.
        # In production it should query the database via the API.
        source = arguments.get("source")
        if source in CONNECTORS:
            metrics = await CONNECTORS[source]().fetch_metrics()
            return [TextContent(type="text", text=json.dumps(metrics, indent=2, default=str))]
        return [TextContent(type="text", text=json.dumps({"error": "source required"}))]

    return [TextContent(type="text", text=json.dumps({"error": "unknown tool"}))]


async def run():
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await mcp.run(read_stream, write_stream, mcp.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(run())
