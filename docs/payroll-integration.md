# Payroll integration webhook

OnTyme can dispatch a finalized payroll integration submission to a provider-neutral HTTPS webhook. This is an integration transport, not a claim that any specific Iranian tax, insurance, bank, or HR provider is supported.

Configure the deployment with:

```text
PAYROLL_WEBHOOK_URL=https://integration.example.test/payroll
PAYROLL_WEBHOOK_SECRET=replace-with-a-secret
```

The dispatcher sends `POST` JSON with `event: "payroll.submission"` and the canonical, checksummed payload in `data`. It also sends `X-Idempotency-Key` and, when configured, `Authorization: Bearer ...`.

The provider must return a successful HTTP status and an explicit JSON acceptance:

```json
{
  "accepted": true,
  "externalReference": "provider-reference-123"
}
```

An HTTP 2xx response without `accepted: true` is treated as rejected and enters the durable retry/failure flow. The dispatch endpoint is:

```text
POST /api/v1/integrations/payroll/submissions/:id/dispatch
```

Only payroll administrators can dispatch, and a submission is claimed atomically to prevent concurrent duplicate attempts. Target-specific adapters remain gated until the target API, schema, authentication, and official documentation are known.
