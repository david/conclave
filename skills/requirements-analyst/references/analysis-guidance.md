# Analysis Guidance

Detailed checklists for actor identification, edge case discovery, and non-functional requirements.

## Actor Types

Common actor types to consider for each feature:

- **End User** — the person using the UI
- **Admin** — elevated privileges
- **System** — automated/background processes (timers, webhooks, cron)
- **External Service** — third-party APIs or integrations

Use consistent actor names across all use cases within a spec.

## Edge Case Probes

Systematically probe each use case for:

- **Empty/zero states**: What if there's no data? First-time user? Empty list?
- **Boundaries**: Max length, min value, pagination limits, rate limits
- **Failures**: Network error, timeout, invalid input, expired session, insufficient permissions
- **Concurrency**: Two users editing the same thing, duplicate submissions, race conditions
- **State transitions**: What happens mid-flow? (browser refresh, back button, session expiry)

Don't enumerate every edge case upfront. Identify the most likely and most damaging ones. Offer to go deeper if the user wants.

## Non-Functional Requirements Checklist

Only when the feature warrants it. Check:

- **Performance**: Response time targets, throughput, data volume
- **Security**: Authentication, authorization, data sensitivity, input validation
- **Accessibility**: Keyboard navigation, screen readers, contrast
- **Compatibility**: Browsers, devices, screen sizes
- **Data**: Retention, backup, migration, GDPR/privacy

Present NFRs separately from use cases — they crosscut multiple use cases.
