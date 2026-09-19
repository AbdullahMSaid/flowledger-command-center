#!/usr/bin/env node

const baseUrl = process.env.FLOWLEDGER_URL;
const flowId = process.env.FLOW_ID;
const flowCredential = process.env.FLOWLEDGER_FLOW_CREDENTIAL;

if (!baseUrl || !flowId || !flowCredential) {
  console.error("Set FLOWLEDGER_URL, FLOW_ID, and FLOWLEDGER_FLOW_CREDENTIAL before running this example.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${flowCredential}`, "Content-Type": "application/json" };
const requestId = `deterministic-example-${Date.now()}`;
const maxCostUsd = Number(process.env.MAX_COST_USD ?? "0.02");

const authorization = await fetch(`${baseUrl}/functions/v1/guard/${flowId}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ request_id: requestId, max_cost_usd: maxCostUsd }),
}).then((response) => response.json());

console.log("Guard decision:", authorization);
if (!authorization.allowed) {
  console.log("Provider callback invoked: false");
  process.exit(0);
}

// This is intentionally a counted deterministic mock provider, never a paid API call.
let providerInvocations = 0;
providerInvocations += 1;
const actualCostUsd = maxCostUsd;
const settlement = await fetch(`${baseUrl}/functions/v1/settle`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    reservation_id: authorization.reservation_id,
    status: "success",
    duration_ms: 120,
    token_count: 64,
    actual_cost_usd: actualCostUsd,
  }),
}).then((response) => response.json());

console.log("Provider callback invoked:", providerInvocations === 1);
console.log("Settlement:", settlement);
