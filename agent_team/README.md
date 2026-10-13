# Agent Team — Phase 1

This is a **deterministic simulation**, not a live LLM agent team. A Chief of Staff coordinator enumerates six specialist roles and produces a JSON report. No market orders, publications, emails, deployments, or external API requests are made.

Run locally: `python -m unittest agent_team.test_run && python -m agent_team.run`.

GitHub Actions can run the simulation on demand or on weekday schedules after the workflow is merged into the default branch. Reports are downloadable run artifacts. The workflow uses read-only repository permissions and requires no secrets.

Before enabling real autonomous agents: implement a bounded task queue, tool allowlists, independent review, API usage budgets, and explicit approval gates for external side effects. Keep credentials in GitHub Actions secrets, never in repository files.
