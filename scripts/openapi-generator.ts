/**
 * OpenAPI Adapter Generator
 *
 * Generates complete adapter definitions from OpenAPI specifications.
 * This ensures 100% API coverage - every endpoint becomes an action.
 */

import type {
  AdapterManifest,
  ActionDefinition,
  TriggerDefinition
} from './types';

// OpenAPI spec sources for major providers
export const OPENAPI_SOURCES = {
  stripe: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  twilio: 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json',
  sendgrid: 'https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json',
  // Add more as needed
} as const;

// Webhook event sources (from official docs)
export const WEBHOOK_SOURCES = {
  stripe: 'https://stripe.com/docs/api/events/types',
  twilio: 'https://www.twilio.com/docs/usage/webhooks',
  sendgrid: 'https://docs.sendgrid.com/for-developers/tracking-events/event',
} as const;

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  webhooks?: Record<string, WebhookItem>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  deprecated?: boolean;
  'x-stripeResource'?: {
    class_name: string;
    in_package: string;
  };
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: Schema;
  deprecated?: boolean;
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: Schema;
}

interface Schema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: string[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  $ref?: string;
  nullable?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

interface Response {
  description?: string;
  content?: Record<string, MediaType>;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

interface WebhookItem {
  post?: Operation;
}

interface GeneratedAdapter {
  slug: string;
  name: string;
  version: string;
  description: string;
  actions: ActionDefinition[];
  triggers: TriggerDefinition[];
  totalEndpoints: number;
  totalWebhooks: number;
  categories: string[];
}

/**
 * Fetch and parse an OpenAPI spec
 */
export async function fetchOpenAPISpec(url: string): Promise<OpenAPISpec> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }
  return response.json();
}

/**
 * Convert OpenAPI path to action ID
 * e.g., "/v1/customers/{customer}" + "get" -> "get_customer"
 */
function pathToActionId(path: string, method: string, operationId?: string): string {
  if (operationId) {
    // Use operationId if available (Stripe uses these)
    return operationId
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__+/g, '_');
  }

  // Generate from path
  const cleanPath = path
    .replace(/\/v\d+\//g, '/') // Remove version prefix
    .replace(/\{[^}]+\}/g, '') // Remove path params
    .replace(/\//g, '_')
    .replace(/^_|_$/g, '')
    .replace(/__+/g, '_');

  return `${method}_${cleanPath}`.toLowerCase();
}

/**
 * Convert OpenAPI path to human-readable name
 */
function pathToActionName(path: string, method: string, summary?: string): string {
  if (summary) {
    return summary;
  }

  const methodNames: Record<string, string> = {
    get: 'Get',
    post: 'Create',
    put: 'Update',
    patch: 'Update',
    delete: 'Delete',
  };

  const resource = path
    .replace(/\/v\d+\//g, '/')
    .replace(/\{[^}]+\}/g, '')
    .split('/')
    .filter(Boolean)
    .pop() || 'Resource';

  const resourceName = resource
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return `${methodNames[method] || method} ${resourceName}`;
}

/**
 * Convert OpenAPI schema to JSON Schema for action config
 */
function convertSchema(schema: Schema | undefined, spec: OpenAPISpec): Record<string, unknown> {
  if (!schema) {
    return { type: 'object', properties: {} };
  }

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    const refSchema = spec.components?.schemas?.[refPath];
    if (refSchema) {
      return convertSchema(refSchema, spec);
    }
  }

  const result: Record<string, unknown> = {};

  if (schema.type) result.type = schema.type;
  if (schema.format) result.format = schema.format;
  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;
  if (schema.minimum !== undefined) result.minimum = schema.minimum;
  if (schema.maximum !== undefined) result.maximum = schema.maximum;
  if (schema.default !== undefined) result.default = schema.default;

  if (schema.properties) {
    result.properties = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      (result.properties as Record<string, unknown>)[key] = convertSchema(propSchema, spec);
    }
  }

  if (schema.items) {
    result.items = convertSchema(schema.items, spec);
  }

  if (schema.required) {
    result.required = schema.required;
  }

  return result;
}

/**
 * Extract category from path or tags
 */
function extractCategory(path: string, tags?: string[]): string {
  if (tags && tags.length > 0) {
    return tags[0].toLowerCase().replace(/\s+/g, '_');
  }

  // Extract from path
  const segments = path.replace(/\/v\d+\//g, '/').split('/').filter(Boolean);
  return segments[0] || 'general';
}

/**
 * Generate actions from OpenAPI paths
 */
function generateActions(spec: OpenAPISpec): ActionDefinition[] {
  const actions: ActionDefinition[] = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation || operation.deprecated) continue;

      const actionId = pathToActionId(path, method, operation.operationId);
      const actionName = pathToActionName(path, method, operation.summary);
      const category = extractCategory(path, operation.tags);

      // Build config schema from parameters and request body
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      // Add path and query parameters
      const allParams = [...(pathItem.parameters || []), ...(operation.parameters || [])];
      for (const param of allParams) {
        if (param.deprecated) continue;

        properties[param.name] = {
          ...convertSchema(param.schema, spec),
          description: param.description,
        };

        if (param.required) {
          required.push(param.name);
        }
      }

      // Add request body properties
      if (operation.requestBody?.content) {
        const jsonContent = operation.requestBody.content['application/json'] ||
                           operation.requestBody.content['application/x-www-form-urlencoded'];
        if (jsonContent?.schema) {
          const bodySchema = convertSchema(jsonContent.schema, spec);
          if (bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
          }
          if (bodySchema.required && Array.isArray(bodySchema.required)) {
            required.push(...bodySchema.required);
          }
        }
      }

      // Build response schema
      let responseSchema: Record<string, unknown> | undefined;
      const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
      if (successResponse?.content?.['application/json']?.schema) {
        responseSchema = convertSchema(successResponse.content['application/json'].schema, spec);
      }

      actions.push({
        id: actionId,
        name: actionName,
        description: operation.description || operation.summary || `${method.toUpperCase()} ${path}`,
        category,
        configSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
        ...(responseSchema ? { responseSchema } : {}),
      });
    }
  }

  return actions;
}

/**
 * Generate triggers from OpenAPI webhooks section or known webhook events
 */
function generateTriggers(spec: OpenAPISpec, knownEvents?: string[]): TriggerDefinition[] {
  const triggers: TriggerDefinition[] = [];

  // From OpenAPI webhooks section (if present)
  if (spec.webhooks) {
    for (const [eventName, webhook] of Object.entries(spec.webhooks)) {
      const operation = webhook.post;
      triggers.push({
        id: eventName.replace(/\./g, '_'),
        name: operation?.summary || eventName.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: operation?.description || `Triggered on ${eventName}`,
        event: eventName,
        payloadSchema: operation?.requestBody?.content?.['application/json']?.schema
          ? convertSchema(operation.requestBody.content['application/json'].schema, spec)
          : undefined,
      });
    }
  }

  // Add known webhook events
  if (knownEvents) {
    for (const event of knownEvents) {
      const existingTrigger = triggers.find(t => t.event === event);
      if (!existingTrigger) {
        triggers.push({
          id: event.replace(/\./g, '_'),
          name: event.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: `Triggered on ${event}`,
          event,
        });
      }
    }
  }

  return triggers;
}

/**
 * Stripe webhook events (complete list)
 */
export const STRIPE_WEBHOOK_EVENTS = [
  // Account events
  'account.updated', 'account.application.authorized', 'account.application.deauthorized',
  'account.external_account.created', 'account.external_account.deleted', 'account.external_account.updated',

  // Application fee events
  'application_fee.created', 'application_fee.refunded', 'application_fee.refund.updated',

  // Balance events
  'balance.available',

  // Billing portal events
  'billing_portal.configuration.created', 'billing_portal.configuration.updated',
  'billing_portal.session.created',

  // Charge events
  'charge.captured', 'charge.expired', 'charge.failed', 'charge.pending', 'charge.refunded',
  'charge.succeeded', 'charge.updated',
  'charge.dispute.closed', 'charge.dispute.created', 'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn', 'charge.dispute.updated',
  'charge.refund.updated',

  // Checkout events
  'checkout.session.async_payment_failed', 'checkout.session.async_payment_succeeded',
  'checkout.session.completed', 'checkout.session.expired',

  // Coupon events
  'coupon.created', 'coupon.deleted', 'coupon.updated',

  // Credit note events
  'credit_note.created', 'credit_note.updated', 'credit_note.voided',

  // Customer events
  'customer.created', 'customer.deleted', 'customer.updated',
  'customer.discount.created', 'customer.discount.deleted', 'customer.discount.updated',
  'customer.source.created', 'customer.source.deleted', 'customer.source.expiring', 'customer.source.updated',
  'customer.subscription.created', 'customer.subscription.deleted', 'customer.subscription.paused',
  'customer.subscription.pending_update_applied', 'customer.subscription.pending_update_expired',
  'customer.subscription.resumed', 'customer.subscription.trial_will_end', 'customer.subscription.updated',
  'customer.tax_id.created', 'customer.tax_id.deleted', 'customer.tax_id.updated',

  // File events
  'file.created',

  // Invoice events
  'invoice.created', 'invoice.deleted', 'invoice.finalization_failed', 'invoice.finalized',
  'invoice.marked_uncollectible', 'invoice.paid', 'invoice.payment_action_required',
  'invoice.payment_failed', 'invoice.payment_succeeded', 'invoice.sent',
  'invoice.upcoming', 'invoice.updated', 'invoice.voided',
  'invoiceitem.created', 'invoiceitem.deleted',

  // Issuing events
  'issuing_authorization.created', 'issuing_authorization.updated',
  'issuing_card.created', 'issuing_card.updated',
  'issuing_cardholder.created', 'issuing_cardholder.updated',
  'issuing_dispute.closed', 'issuing_dispute.created', 'issuing_dispute.funds_reinstated',
  'issuing_dispute.submitted', 'issuing_dispute.updated',
  'issuing_transaction.created', 'issuing_transaction.updated',

  // Mandate events
  'mandate.updated',

  // Payment intent events
  'payment_intent.amount_capturable_updated', 'payment_intent.canceled', 'payment_intent.created',
  'payment_intent.partially_funded', 'payment_intent.payment_failed', 'payment_intent.processing',
  'payment_intent.requires_action', 'payment_intent.succeeded',

  // Payment link events
  'payment_link.created', 'payment_link.updated',

  // Payment method events
  'payment_method.attached', 'payment_method.automatically_updated', 'payment_method.detached',
  'payment_method.updated',

  // Payout events
  'payout.canceled', 'payout.created', 'payout.failed', 'payout.paid',
  'payout.reconciliation_completed', 'payout.updated',

  // Person events
  'person.created', 'person.deleted', 'person.updated',

  // Plan events
  'plan.created', 'plan.deleted', 'plan.updated',

  // Price events
  'price.created', 'price.deleted', 'price.updated',

  // Product events
  'product.created', 'product.deleted', 'product.updated',

  // Promotion code events
  'promotion_code.created', 'promotion_code.updated',

  // Quote events
  'quote.accepted', 'quote.canceled', 'quote.created', 'quote.finalized',

  // Radar events
  'radar.early_fraud_warning.created', 'radar.early_fraud_warning.updated',

  // Refund events
  'refund.created', 'refund.updated',

  // Reporting events
  'reporting.report_run.failed', 'reporting.report_run.succeeded',
  'reporting.report_type.updated',

  // Review events
  'review.closed', 'review.opened',

  // Setup intent events
  'setup_intent.canceled', 'setup_intent.created', 'setup_intent.requires_action',
  'setup_intent.setup_failed', 'setup_intent.succeeded',

  // Sigma events
  'sigma.scheduled_query_run.created',

  // Source events
  'source.canceled', 'source.chargeable', 'source.failed',
  'source.mandate_notification', 'source.refund_attributes_required',
  'source.transaction.created', 'source.transaction.updated',

  // Subscription schedule events
  'subscription_schedule.aborted', 'subscription_schedule.canceled', 'subscription_schedule.completed',
  'subscription_schedule.created', 'subscription_schedule.expiring', 'subscription_schedule.released',
  'subscription_schedule.updated',

  // Tax rate events
  'tax_rate.created', 'tax_rate.updated',

  // Terminal events
  'terminal.reader.action_failed', 'terminal.reader.action_succeeded',

  // Test helpers events
  'test_helpers.test_clock.advancing', 'test_helpers.test_clock.created',
  'test_helpers.test_clock.deleted', 'test_helpers.test_clock.internal_failure',
  'test_helpers.test_clock.ready',

  // Topup events
  'topup.canceled', 'topup.created', 'topup.failed', 'topup.reversed', 'topup.succeeded',

  // Transfer events
  'transfer.created', 'transfer.reversed', 'transfer.updated',

  // Treasury events (if using Stripe Treasury)
  'treasury.credit_reversal.created', 'treasury.credit_reversal.posted',
  'treasury.debit_reversal.completed', 'treasury.debit_reversal.created',
  'treasury.debit_reversal.initial_credit_granted',
  'treasury.financial_account.closed', 'treasury.financial_account.created',
  'treasury.financial_account.features_status_updated',
  'treasury.inbound_transfer.canceled', 'treasury.inbound_transfer.created',
  'treasury.inbound_transfer.failed', 'treasury.inbound_transfer.succeeded',
  'treasury.outbound_payment.canceled', 'treasury.outbound_payment.created',
  'treasury.outbound_payment.expected_arrival_date_updated', 'treasury.outbound_payment.failed',
  'treasury.outbound_payment.posted', 'treasury.outbound_payment.returned',
  'treasury.outbound_transfer.canceled', 'treasury.outbound_transfer.created',
  'treasury.outbound_transfer.expected_arrival_date_updated', 'treasury.outbound_transfer.failed',
  'treasury.outbound_transfer.posted', 'treasury.outbound_transfer.returned',
  'treasury.received_credit.created', 'treasury.received_credit.failed',
  'treasury.received_credit.succeeded',
  'treasury.received_debit.created',
];

/**
 * Generate a complete adapter from an OpenAPI spec
 */
export async function generateAdapterFromOpenAPI(
  slug: string,
  name: string,
  specUrl: string,
  knownWebhookEvents?: string[]
): Promise<GeneratedAdapter> {
  console.log(`Fetching OpenAPI spec from ${specUrl}...`);
  const spec = await fetchOpenAPISpec(specUrl);

  console.log(`Generating actions from ${Object.keys(spec.paths).length} paths...`);
  const actions = generateActions(spec);

  console.log(`Generating triggers...`);
  const triggers = generateTriggers(spec, knownWebhookEvents);

  // Extract unique categories
  const categories = [...new Set(actions.map(a => a.category))].filter(Boolean);

  return {
    slug,
    name,
    version: spec.info.version || '1.0.0',
    description: spec.info.description || `${name} integration`,
    actions,
    triggers,
    totalEndpoints: actions.length,
    totalWebhooks: triggers.length,
    categories,
  };
}

/**
 * Generate the full Stripe adapter
 */
export async function generateStripeAdapter(): Promise<GeneratedAdapter> {
  return generateAdapterFromOpenAPI(
    'stripe',
    'Stripe',
    OPENAPI_SOURCES.stripe,
    STRIPE_WEBHOOK_EVENTS
  );
}

/**
 * Generate adapter and write to registry format
 */
export async function generateAndWriteAdapter(
  slug: string,
  name: string,
  specUrl: string,
  knownWebhookEvents?: string[]
): Promise<{
  adapterJson: Record<string, unknown>;
  manifestJson: Record<string, unknown>;
  stats: { actions: number; triggers: number; categories: string[] };
}> {
  const adapter = await generateAdapterFromOpenAPI(slug, name, specUrl, knownWebhookEvents);

  const adapterJson = {
    slug: adapter.slug,
    name: adapter.name,
    version: adapter.version,
    description: adapter.description,
    type: getAdapterType(slug),
    provider: {
      name: adapter.name,
      website: getProviderWebsite(slug),
      documentation: getProviderDocs(slug),
    },
    authentication: getAuthConfig(slug),
    rateLimit: getRateLimitConfig(slug),
    generatedFrom: 'openapi',
    generatedAt: new Date().toISOString(),
  };

  const manifestJson = {
    actions: adapter.actions,
    triggers: adapter.triggers,
    webhooks: getWebhookConfig(slug),
    mcp: {
      tools: generateMCPTools(adapter),
    },
  };

  return {
    adapterJson,
    manifestJson,
    stats: {
      actions: adapter.actions.length,
      triggers: adapter.triggers.length,
      categories: adapter.categories,
    },
  };
}

// Helper functions for adapter metadata
function getAdapterType(slug: string): string {
  const types: Record<string, string> = {
    stripe: 'payment',
    twilio: 'sms',
    sendgrid: 'email',
    docusign: 'esignature',
    xero: 'accounting',
    sumsub: 'kyc',
  };
  return types[slug] || 'custom';
}

function getProviderWebsite(slug: string): string {
  const sites: Record<string, string> = {
    stripe: 'https://stripe.com',
    twilio: 'https://twilio.com',
    sendgrid: 'https://sendgrid.com',
    docusign: 'https://docusign.com',
    xero: 'https://xero.com',
    sumsub: 'https://sumsub.com',
  };
  return sites[slug] || '';
}

function getProviderDocs(slug: string): string {
  const docs: Record<string, string> = {
    stripe: 'https://stripe.com/docs/api',
    twilio: 'https://www.twilio.com/docs/api',
    sendgrid: 'https://docs.sendgrid.com/api-reference',
    docusign: 'https://developers.docusign.com/docs',
    xero: 'https://developer.xero.com/documentation',
    sumsub: 'https://docs.sumsub.com',
  };
  return docs[slug] || '';
}

function getAuthConfig(slug: string): Record<string, unknown> {
  // Return auth configuration based on provider
  const configs: Record<string, Record<string, unknown>> = {
    stripe: {
      type: 'api_key',
      fields: [
        { name: 'secret_key', label: 'Secret Key', type: 'password', required: true },
        { name: 'publishable_key', label: 'Publishable Key', type: 'text', required: false },
        { name: 'webhook_secret', label: 'Webhook Signing Secret', type: 'password', required: false },
      ],
    },
    twilio: {
      type: 'api_key',
      fields: [
        { name: 'account_sid', label: 'Account SID', type: 'text', required: true },
        { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
      ],
    },
    sendgrid: {
      type: 'api_key',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'password', required: true },
      ],
    },
  };
  return configs[slug] || { type: 'api_key', fields: [] };
}

function getRateLimitConfig(slug: string): Record<string, unknown> {
  const limits: Record<string, Record<string, unknown>> = {
    stripe: { requestsPerMinute: 100, requestsPerSecond: 25 },
    twilio: { requestsPerMinute: 100 },
    sendgrid: { requestsPerMinute: 600 },
  };
  return limits[slug] || { requestsPerMinute: 60 };
}

function getWebhookConfig(slug: string): Record<string, unknown> {
  const configs: Record<string, Record<string, unknown>> = {
    stripe: {
      supported: true,
      signatureHeader: 'stripe-signature',
      signatureAlgorithm: 'hmac-sha256',
    },
    twilio: {
      supported: true,
      signatureHeader: 'x-twilio-signature',
      signatureAlgorithm: 'hmac-sha1',
    },
    sendgrid: {
      supported: true,
      signatureHeader: 'x-twilio-email-event-webhook-signature',
      signatureAlgorithm: 'ecdsa',
    },
  };
  return configs[slug] || { supported: false };
}

function generateMCPTools(adapter: GeneratedAdapter): Array<Record<string, unknown>> {
  // Generate smart MCP tools that combine multiple actions
  const tools: Array<Record<string, unknown>> = [];

  // Add a tool for each category that combines common operations
  for (const category of adapter.categories.slice(0, 20)) { // Limit to prevent huge files
    const categoryActions = adapter.actions.filter(a => a.category === category);
    if (categoryActions.length === 0) continue;

    // Find CRUD operations for this category
    const createAction = categoryActions.find(a => a.id.startsWith('create_') || a.id.startsWith('post_'));
    const listAction = categoryActions.find(a => a.id.startsWith('list_') || a.id.startsWith('get_') && a.id.includes('all'));

    if (createAction) {
      tools.push({
        name: `${adapter.slug}_${category}_create`,
        description: `Create a new ${category} in ${adapter.name}`,
        inputSchema: createAction.configSchema,
      });
    }

    if (listAction) {
      tools.push({
        name: `${adapter.slug}_${category}_list`,
        description: `List ${category} from ${adapter.name}`,
        inputSchema: listAction.configSchema,
      });
    }
  }

  return tools;
}
