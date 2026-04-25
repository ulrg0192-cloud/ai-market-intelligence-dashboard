# BASE_PROJECT_RULES.md
Generic Evolvable Governance – v1.0

------------------------------------------------------------

## 1. Title
Base Governance Rules for New Projects

------------------------------------------------------------

## 2. Context
We are initializing a new project.

This file defines the foundational engineering rules.
It is intentionally generic and minimal.

It must:
- Work for any tech stack
- Be extendable over time
- Avoid over-engineering
- Prioritize safety and maintainability

This file is version-controlled and evolves with the project.

------------------------------------------------------------

## 3. Task
Establish baseline governance rules that:

- Prevent common engineering mistakes
- Enforce clarity
- Ensure security
- Allow future expansion without breaking structure

Do NOT assume any specific language or framework.

------------------------------------------------------------

## 4. Core Requirements

### 4.1 Tech Stack Declaration (Mandatory Per Project)

Before generating code, always confirm:

- Language + version
- Runtime
- Framework (if any)
- Package manager
- Database (if any)

Never assume technologies.

------------------------------------------------------------

### 4.2 Code Style (Minimal Baseline)

- Functions ≤ 40 lines
- Single responsibility principle
- Clear descriptive naming
- No hardcoded secrets
- No dead commented code
- No unnecessary console logging
- Prefer type safety when supported

More specific style rules may be added later.

------------------------------------------------------------

### 4.3 Commands (Must Be Explicit)

Each project must define:

- Dev server command
- Test command
- Build command
- Lint command
- Format command

If missing → request clarification.

Never invent commands.

------------------------------------------------------------

### 4.4 Testing (Baseline Policy)

- Every feature should include tests
- Tests must be isolated
- Tests must not depend on external systems
- Define minimum coverage (default recommendation: 80%)

Framework must be explicitly declared.

------------------------------------------------------------

### 4.5 Git Rules

- Use Conventional Commits
- No force push without explicit confirmation
- No committing secrets
- main = stable branch

Branching strategy can evolve per project scale.

------------------------------------------------------------

### 4.6 Security & Safety (Non-Negotiable)

Never:
- Store secrets in code
- Commit .env files
- Expose API keys
- Modify files outside project root

Ask confirmation before:
- Destructive commands
- Installing new dependencies
- Large refactors (>3 files)

------------------------------------------------------------

### 4.7 Communication Rules

- Be concise
- Avoid unnecessary explanations
- Ask before major structural changes
- Clarify missing technical details before proceeding

------------------------------------------------------------

## 5. Extensibility Model

This file is intentionally minimal.

When:
- A repeated mistake happens → add a rule.
- The project grows → specialize sections.
- Complexity increases → modularize:

Example:
@./security.md
@./testing.md
@./architecture.md

Keep this file lightweight.

------------------------------------------------------------

## 6. Constraints

- Do not over-engineer early
- Do not introduce architecture patterns prematurely
- Do not assume microservices
- Do not introduce dependencies without justification

------------------------------------------------------------

## 7. Validation / Self-Check

Before completing any task, verify:

- No rule violation
- No secret exposure
- No destructive action without confirmation
- No technology assumptions
- Maintainability preserved

If uncertain → ask.

------------------------------------------------------------

Version: 1.0
This file must always be committed.