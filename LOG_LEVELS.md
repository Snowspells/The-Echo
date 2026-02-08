Log levels reference

This file documents available log levels and what they include. It is informational only and not executed by the bot.

Available levels (from least to most verbose):

- error
  - Purpose: Only critical errors that require attention.
  - Includes: Unhandled exceptions, failed operations with stack traces (when an Error object is provided).
  - Use to: Monitor production stability and catch crashes.

- warn
  - Purpose: Warnings that may indicate misconfiguration or recoverable issues.
  - Includes: Non-fatal errors, deprecated API usage warnings, suspicious conditions.
  - Use to: Investigate potential problems before they escalate.

- success
  - Purpose: Positive confirmations of important operations.
  - Includes: Successful completion messages for key operations (e.g., command registration, startup completion).
  - Use to: Confirm normal operations without verbose detail.

- info (default)
  - Purpose: General operational information about the bot.
  - Includes: Startup messages, command/component loading, user-link events, and other routine activity.
  - Use to: Understand normal behavior and audit recent activity.

- debug
  - Purpose: Detailed diagnostic information for troubleshooting.
  - Includes: Everything from `info` plus verbose details, function-level debug messages, and additional context to trace execution.
  - Use to: Diagnose issues during development or when investigating complex bugs.

Notes
- Configure the level via `.env` with `LOG_LEVEL=info` (or any other level above) or set at runtime using `setLogLevel()`.
- Lower levels include higher-severity logs. For example, `info` will include `success`, `warn`, and `error` messages.
- Log output is written to `terminal.log` in the project root (append-only).
- Use `debug` sparingly in production due to verbosity and potential sensitive data exposure.
