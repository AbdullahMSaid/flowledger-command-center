#!/usr/bin/env node

// Server-backed smoke check for a configured local/staging FlowLedger project.
// The provider callback below is deliberately counted and deterministic.

const baseUrl = process.env.FLOWLEDGER_URL;
const flowId = process.env.FLOW_ID;
const flowCredential = process.env.FLOWLEDGER_FLOW_CREDENTIAL;
const maxCostUsd = Number(process.env.GUARD_TEST_MAX_COST_USD ?? "0.01");
const expectDenied = process.env.EXPECT_GUARD_DENIAL === "1";

if (!baseUrl || !flowId || !flowCredential || !Number.isFinite(maxCostUsd) || maxCostUsd < 0) {
  console.error("Set FLOWLEDGER_URL, FLOW_ID, FLOWLEDGER_FLOW_CREDENTIAL, and optionally GUARD_TEST_MAX_COST_USD / EXPECT_GUARD_DENIAL=1.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${flowCredential}`,
  "Content-Type": "application/json",
};
const requestId = `guard-smoke-${Date.now()}`;
const responseJson = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
};

const authorization = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/guard/${flowId}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ request_id: requestId, max_cost_usd: maxCostUsd }),
}).then(responseJson);

let providerInvocations = 0;
if (authorization.allowed) {
  // This is the only provider callback. A deny decision never reaches this line.
  providerInvocations += 1;
  const settlementBody = {
    reservation_id: authorization.reservation_id,
    status: "success",
    duration_ms: 120,
    token_count: 64,
    actual_cost_usd: maxCostUsd,
  };
  const firstSettlement = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify(settlementBody),
  }).then(responseJson);
  const secondSettlement = await fetch(`${baseUrl.replace(/\/$/, "")}/functions/v1/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify(settlementBody),
  }).then(responseJson);

  if (firstSettlement.run_id !== secondSettlement.run_id) {
    throw new Error("Repeated settlement returned different run IDs");
  }
  console.log(JSON.stringify({ authorization, providerInvocations, firstSettlement, secondSettlement }, null, 2));
} else {
  console.log(JSON.stringify({ authorization, providerInvocations }, null, 2));
}

if (expectDenied && (authorization.allowed || providerInvocations !== 0)) {
  throw new Error("Expected guard denial before provider execution");
}
if (authorization.allowed && providerInvocations !== 1) {
  throw new Error("An allowed request must invoke the counted provider exactly once");
}
