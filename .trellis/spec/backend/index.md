# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory describes Novella's platform-neutral client backend. It is
shared by Expo mobile and a possible Electron desktop application; it is not a
server implementation.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | To fill |
| [Error Handling](./error-handling.md) | Error types, handling strategies | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | To fill |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | To fill |
| [Authentication Credential Contracts](./auth-credential-contracts.md) | TypeScript session refresh, credential ports, authenticated retry, and sensitive logs | Active |
| [Request Scheduling](./request-scheduling.md) | Shared HTTP/Hub rate limit, priorities, cancellation, and reader preloading | Active |
| [API Response Decoding](./api-response-decoding.md) | Required vs optional text normalization at the Web-Master DTO boundary | Active |
| [Account Invite Reset and Growth Shop](./account-shop-contracts.md) | Invite reset, shop payloads, serialized purchases, and confirmed-state fallback | Active |
| [Community Thread Edit and Delete](./community-thread-contracts.md) | Current thread fields, server permissions, edit/delete operations, and focused pagination | Active |

---

## Pre-Development Checklist

- For changes to authentication refresh, credential storage, logout, API 401
  retry, SignalR restart, or their logs, read
  [Authentication Credential Contracts](./auth-credential-contracts.md).
- For request queues, rate limits, Hub invocation priority, cancellation, or
  reader preloading, read [Request Scheduling](./request-scheduling.md).
- For Web-Master DTO additions or decoder changes, read
  [API Response Decoding](./api-response-decoding.md).
- For invite reset or mobile growth-shop changes, read
  [Account Invite Reset and Growth Shop](./account-shop-contracts.md).
- For Community thread detail, edit/delete, or reply paging changes, read
  [Community Thread Edit and Delete](./community-thread-contracts.md).

## Quality Check

- Apply the validation matrix and required tests in
  [Authentication Credential Contracts](./auth-credential-contracts.md) when
  auth, sync credentials, or authenticated networking are affected.

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
