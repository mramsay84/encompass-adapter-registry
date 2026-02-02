/**
 * Generate Complete Stripe Adapter from OpenAPI Spec
 *
 * This pulls Stripe's official OpenAPI spec and generates a complete adapter
 * with ALL endpoints as actions and ALL webhook events as triggers.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STRIPE_OPENAPI_URL = 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json';

// All Stripe webhook events (complete list from docs)
const STRIPE_WEBHOOK_EVENTS = [
  // Account
  'account.updated', 'account.application.authorized', 'account.application.deauthorized',
  'account.external_account.created', 'account.external_account.deleted', 'account.external_account.updated',

  // Application fee
  'application_fee.created', 'application_fee.refunded', 'application_fee.refund.updated',

  // Balance
  'balance.available',

  // Billing portal
  'billing_portal.configuration.created', 'billing_portal.configuration.updated', 'billing_portal.session.created',

  // Charge
  'charge.captured', 'charge.expired', 'charge.failed', 'charge.pending', 'charge.refunded',
  'charge.succeeded', 'charge.updated',
  'charge.dispute.closed', 'charge.dispute.created', 'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn', 'charge.dispute.updated',
  'charge.refund.updated',

  // Checkout
  'checkout.session.async_payment_failed', 'checkout.session.async_payment_succeeded',
  'checkout.session.completed', 'checkout.session.expired',

  // Coupon
  'coupon.created', 'coupon.deleted', 'coupon.updated',

  // Credit note
  'credit_note.created', 'credit_note.updated', 'credit_note.voided',

  // Customer
  'customer.created', 'customer.deleted', 'customer.updated',
  'customer.discount.created', 'customer.discount.deleted', 'customer.discount.updated',
  'customer.source.created', 'customer.source.deleted', 'customer.source.expiring', 'customer.source.updated',
  'customer.subscription.created', 'customer.subscription.deleted', 'customer.subscription.paused',
  'customer.subscription.pending_update_applied', 'customer.subscription.pending_update_expired',
  'customer.subscription.resumed', 'customer.subscription.trial_will_end', 'customer.subscription.updated',
  'customer.tax_id.created', 'customer.tax_id.deleted', 'customer.tax_id.updated',

  // File
  'file.created',

  // Invoice
  'invoice.created', 'invoice.deleted', 'invoice.finalization_failed', 'invoice.finalized',
  'invoice.marked_uncollectible', 'invoice.paid', 'invoice.payment_action_required',
  'invoice.payment_failed', 'invoice.payment_succeeded', 'invoice.sent',
  'invoice.upcoming', 'invoice.updated', 'invoice.voided',
  'invoiceitem.created', 'invoiceitem.deleted',

  // Issuing
  'issuing_authorization.created', 'issuing_authorization.updated',
  'issuing_card.created', 'issuing_card.updated',
  'issuing_cardholder.created', 'issuing_cardholder.updated',
  'issuing_dispute.closed', 'issuing_dispute.created', 'issuing_dispute.funds_reinstated',
  'issuing_dispute.submitted', 'issuing_dispute.updated',
  'issuing_transaction.created', 'issuing_transaction.updated',

  // Mandate
  'mandate.updated',

  // Payment intent
  'payment_intent.amount_capturable_updated', 'payment_intent.canceled', 'payment_intent.created',
  'payment_intent.partially_funded', 'payment_intent.payment_failed', 'payment_intent.processing',
  'payment_intent.requires_action', 'payment_intent.succeeded',

  // Payment link
  'payment_link.created', 'payment_link.updated',

  // Payment method
  'payment_method.attached', 'payment_method.automatically_updated', 'payment_method.detached', 'payment_method.updated',

  // Payout
  'payout.canceled', 'payout.created', 'payout.failed', 'payout.paid', 'payout.reconciliation_completed', 'payout.updated',

  // Person
  'person.created', 'person.deleted', 'person.updated',

  // Plan
  'plan.created', 'plan.deleted', 'plan.updated',

  // Price
  'price.created', 'price.deleted', 'price.updated',

  // Product
  'product.created', 'product.deleted', 'product.updated',

  // Promotion code
  'promotion_code.created', 'promotion_code.updated',

  // Quote
  'quote.accepted', 'quote.canceled', 'quote.created', 'quote.finalized',

  // Radar
  'radar.early_fraud_warning.created', 'radar.early_fraud_warning.updated',

  // Refund
  'refund.created', 'refund.updated',

  // Reporting
  'reporting.report_run.failed', 'reporting.report_run.succeeded', 'reporting.report_type.updated',

  // Review
  'review.closed', 'review.opened',

  // Setup intent
  'setup_intent.canceled', 'setup_intent.created', 'setup_intent.requires_action',
  'setup_intent.setup_failed', 'setup_intent.succeeded',

  // Sigma
  'sigma.scheduled_query_run.created',

  // Source
  'source.canceled', 'source.chargeable', 'source.failed',
  'source.mandate_notification', 'source.refund_attributes_required',
  'source.transaction.created', 'source.transaction.updated',

  // Subscription schedule
  'subscription_schedule.aborted', 'subscription_schedule.canceled', 'subscription_schedule.completed',
  'subscription_schedule.created', 'subscription_schedule.expiring', 'subscription_schedule.released',
  'subscription_schedule.updated',

  // Tax rate
  'tax_rate.created', 'tax_rate.updated',

  // Terminal
  'terminal.reader.action_failed', 'terminal.reader.action_succeeded',

  // Test helpers
  'test_helpers.test_clock.advancing', 'test_helpers.test_clock.created',
  'test_helpers.test_clock.deleted', 'test_helpers.test_clock.internal_failure',
  'test_helpers.test_clock.ready',

  // Topup
  'topup.canceled', 'topup.created', 'topup.failed', 'topup.reversed', 'topup.succeeded',

  // Transfer
  'transfer.created', 'transfer.reversed', 'transfer.updated',

  // Treasury
  'treasury.credit_reversal.created', 'treasury.credit_reversal.posted',
  'treasury.debit_reversal.completed', 'treasury.debit_reversal.created', 'treasury.debit_reversal.initial_credit_granted',
  'treasury.financial_account.closed', 'treasury.financial_account.created', 'treasury.financial_account.features_status_updated',
  'treasury.inbound_transfer.canceled', 'treasury.inbound_transfer.created', 'treasury.inbound_transfer.failed', 'treasury.inbound_transfer.succeeded',
  'treasury.outbound_payment.canceled', 'treasury.outbound_payment.created', 'treasury.outbound_payment.expected_arrival_date_updated',
  'treasury.outbound_payment.failed', 'treasury.outbound_payment.posted', 'treasury.outbound_payment.returned',
  'treasury.outbound_transfer.canceled', 'treasury.outbound_transfer.created', 'treasury.outbound_transfer.expected_arrival_date_updated',
  'treasury.outbound_transfer.failed', 'treasury.outbound_transfer.posted', 'treasury.outbound_transfer.returned',
  'treasury.received_credit.created', 'treasury.received_credit.failed', 'treasury.received_credit.succeeded',
  'treasury.received_debit.created',
];

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, any> };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: any[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  deprecated?: boolean;
}

interface Action {
  id: string;
  name: string;
  description: string;
  category: string;
  configSchema: any;
  responseSchema?: any;
}

interface Trigger {
  id: string;
  name: string;
  description: string;
  event: string;
}

async function fetchSpec(): Promise<OpenAPISpec> {
  console.log('Fetching Stripe OpenAPI spec...');
  const response = await fetch(STRIPE_OPENAPI_URL);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  return response.json();
}

function operationIdToActionId(operationId: string): string {
  // Convert Stripe's operationId format to snake_case
  // e.g., "GetCustomers" -> "get_customers"
  return operationId
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

function operationIdToName(operationId: string, summary?: string): string {
  if (summary) return summary;
  // Convert "GetCustomers" to "Get Customers"
  return operationId.replace(/([A-Z])/g, ' $1').trim();
}

function resolveRef(ref: string, spec: OpenAPISpec): any {
  const path = ref.replace('#/components/schemas/', '');
  return spec.components?.schemas?.[path];
}

function simplifySchema(schema: any, spec: OpenAPISpec, depth = 0): any {
  if (!schema || depth > 3) return { type: 'object' };

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    return simplifySchema(resolved, spec, depth + 1);
  }

  const result: any = {};

  if (schema.type) result.type = schema.type;
  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;
  if (schema.format) result.format = schema.format;

  if (schema.properties && depth < 2) {
    result.properties = {};
    for (const [key, val] of Object.entries(schema.properties as Record<string, any>)) {
      result.properties[key] = simplifySchema(val, spec, depth + 1);
    }
  }

  if (schema.items) {
    result.items = simplifySchema(schema.items, spec, depth + 1);
  }

  if (schema.required) result.required = schema.required;

  return result;
}

function extractCategory(tags?: string[]): string {
  if (!tags || tags.length === 0) return 'general';
  return tags[0].toLowerCase().replace(/\s+/g, '_');
}

function generateActions(spec: OpenAPISpec): Action[] {
  const actions: Action[] = [];
  const methods = ['get', 'post', 'delete'] as const;

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const op = pathItem[method];
      if (!op || op.deprecated) continue;
      if (!op.operationId) continue;

      const actionId = operationIdToActionId(op.operationId);
      const category = extractCategory(op.tags);

      // Build config schema
      const properties: Record<string, any> = {};
      const required: string[] = [];

      // Path/query parameters
      const params = [...(pathItem.parameters || []), ...(op.parameters || [])];
      for (const param of params) {
        if (param.deprecated) continue;
        properties[param.name] = {
          type: param.schema?.type || 'string',
          description: param.description,
        };
        if (param.required) required.push(param.name);
      }

      // Request body
      if (op.requestBody?.content) {
        const content = op.requestBody.content['application/x-www-form-urlencoded'] ||
                       op.requestBody.content['application/json'];
        if (content?.schema) {
          const bodySchema = simplifySchema(content.schema, spec);
          if (bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
          }
          if (bodySchema.required) {
            required.push(...bodySchema.required.filter((r: string) => !required.includes(r)));
          }
        }
      }

      actions.push({
        id: actionId,
        name: operationIdToName(op.operationId, op.summary),
        description: op.description || op.summary || `${method.toUpperCase()} ${path}`,
        category,
        configSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      });
    }
  }

  return actions;
}

function generateTriggers(): Trigger[] {
  return STRIPE_WEBHOOK_EVENTS.map(event => ({
    id: event.replace(/\./g, '_'),
    name: event.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
    description: `Triggered when ${event.replace(/\./g, ' ')} occurs`,
    event,
  }));
}

async function main() {
  const spec = await fetchSpec();

  console.log(`OpenAPI version: ${spec.openapi}`);
  console.log(`API version: ${spec.info.version}`);
  console.log(`Total paths: ${Object.keys(spec.paths).length}`);

  const actions = generateActions(spec);
  const triggers = generateTriggers();

  console.log(`\nGenerated ${actions.length} actions`);
  console.log(`Generated ${triggers.length} triggers`);

  // Get unique categories
  const categories = [...new Set(actions.map(a => a.category))];
  console.log(`Categories: ${categories.join(', ')}`);

  // Create adapter.json
  const adapterJson = {
    slug: 'stripe',
    name: 'Stripe',
    version: spec.info.version,
    description: 'Complete Stripe API integration - payments, subscriptions, invoices, customers, and more',
    type: 'payment',
    provider: {
      name: 'Stripe',
      website: 'https://stripe.com',
      documentation: 'https://stripe.com/docs/api',
      logo: 'https://stripe.com/img/v3/home/twitter.png',
    },
    authentication: {
      type: 'api_key',
      fields: [
        { name: 'secret_key', label: 'Secret Key', type: 'password', required: true, placeholder: 'sk_live_...' },
        { name: 'publishable_key', label: 'Publishable Key', type: 'text', required: false, placeholder: 'pk_live_...' },
        { name: 'webhook_secret', label: 'Webhook Signing Secret', type: 'password', required: false, placeholder: 'whsec_...' },
      ],
      testEndpoint: 'https://api.stripe.com/v1/balance',
    },
    rateLimit: {
      requestsPerSecond: 100,
      requestsPerMinute: 2000,
    },
    tags: ['payments', 'subscriptions', 'invoices', 'billing', 'checkout', 'connect'],
    generatedFrom: 'openapi',
    generatedAt: new Date().toISOString(),
    openApiVersion: spec.info.version,
  };

  // Create manifest.json
  const manifestJson = {
    actions,
    triggers,
    webhooks: {
      supported: true,
      signatureHeader: 'stripe-signature',
      signatureAlgorithm: 'hmac-sha256',
    },
  };

  // Write files
  const adapterDir = join(process.cwd(), 'adapters', 'stripe');
  mkdirSync(adapterDir, { recursive: true });

  writeFileSync(join(adapterDir, 'adapter.json'), JSON.stringify(adapterJson, null, 2));
  writeFileSync(join(adapterDir, 'manifest.json'), JSON.stringify(manifestJson, null, 2));

  console.log(`\n✅ Stripe adapter generated!`);
  console.log(`   - ${actions.length} actions`);
  console.log(`   - ${triggers.length} triggers`);
  console.log(`   - ${categories.length} categories`);
  console.log(`\nFiles written to: ${adapterDir}`);
}

main().catch(console.error);
