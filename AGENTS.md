# daily-builds

A repository of standalone daily projects. Each project lives in its own top-level subdirectory (for example `agendatax/`) and is self-contained with its own dependencies, README, and license.

## Cursor Cloud specific instructions

- Non-obvious layout: the `main` branch is an almost-empty index (just `README.md`, `LICENSE`, `.gitignore`). The actual application code lives in a project subdirectory on a feature branch (currently `agendatax/` on the `cursor/daily-project-generation-process-8538` branch). If `main` looks empty, check the project branches for the app you need to work on.
- Each project subdirectory is independent. `cd` into it and use its own scripts/tooling. See the project's own `README.md`, `package.json`, and `AGENTS.md` for standard commands rather than assuming a repo-wide toolchain.
- The current project, `agendatax/`, is a Next.js 16 app; see `agendatax/AGENTS.md` for its dev/build/lint/verify commands and caveats.
- The startup update script installs dependencies for every top-level project subdirectory that has a `package.json`, so newly added daily projects are handled automatically.
