# Bug research.md Format

```markdown
# Bug: <Short Title>

<One-line description of the observed problem.>

## Symptom

What the user sees or what goes wrong. Include error messages, incorrect output, or unexpected behavior.

## Root Cause

The specific code defect and why it produces the symptom.

- **Where:** `path/to/file.ts:functionName` (line N)
- **What:** Description of the defective logic
- **Why:** The assumption, oversight, or error that introduced it

## Missing Test Coverage

What tests would have caught this bug:

- **Test 1:** <scenario description> — would have failed because <reason>
- **Test 2:** ...

If existing tests should have caught it but didn't, explain why they missed it.

## Fix Approach

Brief description of the fix strategy — what needs to change and why this approach is preferred over alternatives. Keep it to a few sentences; the detailed steps belong in implementation.md.
```

## Guidelines

- Be specific about locations — name files, functions, and lines.
- Explain the causal chain from defect to symptom.
- The "Missing Test Coverage" section describes tests, not test code. Name the scenario and what it would assert.
- Keep it concise. This is a diagnostic record, not a narrative.
