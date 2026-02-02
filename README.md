# Encompass Adapter Registry

Official registry of system adapters for the Encompass platform.

## Repository Structure

```
encompass-adapter-registry/
├── manifest.json                 # Master list of all adapters
├── schemas/
│   ├── adapter.schema.json       # JSON Schema for adapter.json
│   └── manifest.schema.json      # JSON Schema for manifest.json
├── adapters/
│   ├── stripe/
│   │   ├── adapter.json          # Metadata, auth config
│   │   └── manifest.json         # Actions, triggers, MCP tools
│   ├── sendgrid/
│   ├── twilio/
│   ├── docusign/
│   ├── sumsub/
│   └── xero/
└── README.md
```

## Available Adapters

| Adapter | Type | Description |
|---------|------|-------------|
| **Stripe** | Payment | Accept payments, subscriptions, invoices |
| **SendGrid** | Email | Transactional email with templates |
| **Twilio** | SMS/Communication | SMS, WhatsApp, voice calls |
| **DocuSign** | E-Signature | Electronic document signing |
| **SumSub** | KYC | Identity verification and AML |
| **Xero** | CRM/Accounting | SMB accounting integration |

## Adapter File Format

### adapter.json

Contains adapter metadata and authentication configuration:

```json
{
  "$schema": "../../schemas/adapter.schema.json",
  "slug": "adapter-slug",
  "name": "Adapter Name",
  "version": "1.0.0",
  "description": "What the adapter does",
  "type": "payment|email|sms|esignature|kyc|crm|...",
  "provider": {
    "name": "Provider Name",
    "website": "https://...",
    "documentation": "https://..."
  },
  "authentication": {
    "type": "api_key|oauth2|basic",
    "fields": [
      {
        "name": "api_key",
        "label": "API Key",
        "type": "password",
        "required": true,
        "helpText": "..."
      }
    ]
  },
  "aiDescription": "Description for AI context",
  "aiInstructions": "Instructions for AI on how to use"
}
```

### manifest.json

Contains actions, triggers, and MCP tool definitions:

```json
{
  "actions": [
    {
      "id": "action_id",
      "name": "Action Name",
      "description": "What the action does",
      "category": "category",
      "configSchema": { ... },
      "responseSchema": { ... }
    }
  ],
  "triggers": [
    {
      "id": "trigger_id",
      "name": "Trigger Name",
      "description": "When this fires",
      "event": "webhook.event.name"
    }
  ],
  "webhooks": {
    "supported": true,
    "signatureHeader": "x-signature-header",
    "signatureAlgorithm": "hmac-sha256"
  },
  "mcp": {
    "tools": [
      {
        "name": "tool_name",
        "description": "Tool description for MCP",
        "inputSchema": { ... }
      }
    ]
  }
}
```

## Sync with Encompass

The Encompass platform syncs with this registry to:

1. Discover available adapters
2. Install/update adapter definitions
3. Generate MCP tools for organizations
4. Provide AI context for system building

Sync is triggered via:
- SuperAdmin UI: "Sync Adapters" button
- API: `POST /api/superadmin/adapters/sync`
- Scheduled: Daily cron job

## Contributing

To add a new adapter:

1. Create a folder under `adapters/` with your adapter slug
2. Create `adapter.json` with metadata and auth config
3. Create `manifest.json` with actions, triggers, and MCP tools
4. Add entry to the root `manifest.json`
5. Submit a pull request

## Versioning

- Adapters use semantic versioning (MAJOR.MINOR.PATCH)
- The registry manifest has its own version
- Breaking changes require a major version bump
- The sync service handles version comparisons and upgrades
