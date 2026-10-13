- **Input:** Take one provider at a time. Require the provider name, the metrics and reporting periods in scope, authoritative provider API documentation, and—when available—an authorized organization account or sanitized sample response. Include the verification date and any project requirements from `backlog.md` or `project_spec.md`.
- For evidence handling, follow [`./validate-evidence.agent.md`](./validate-evidence.agent.md).
- **Process:**
  + Verify each metric, unit, date boundary, identity field, permission, pagination behavior, and rate limit independently against current official documentation.
  + Use an authorized account or sanitized response to confirm account-specific access and actual response coverage.
  + Record an evidence link or exact source reference and verification date for every capability.
  + Mark each capability `Verified`, `Docs verified; account unverified`, `Unsupported`, or `Unverified`.
  + Derive implementation boundaries only from verified evidence; identify required follow-up access or decisions.
- **Output:** Return one provider capability matrix with columns for provider, metric, unit, supported period, identity coverage, permissions, pagination/rate limits, status, evidence, and open gaps. Follow it with concise implementation constraints and unresolved verification actions. Preserve unsupported and unavailable states explicitly.
- **Constraints:** Keep providers and unlike metrics separate. Never include credentials, personal usage details, or unsanitized provider payloads.
