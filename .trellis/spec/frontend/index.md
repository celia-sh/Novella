# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Expo, React site, Electron and shared package boundaries | Active |
| [Component Guidelines](./component-guidelines.md) | React and React Native component boundaries | Active |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state, and device-local settings compatibility | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns, verification/acceptance policy | Active |
| [Localization Guidelines](./localization-guidelines.md) | Simplified/Traditional Chinese resources, locale resolution, formatting, native metadata | Active |
| [Build Compatibility Version](./build-version-contract.md) | Automatic local/CI backend-compatible app version resolution | Active |
| [Type Safety](./type-safety.md) | Type patterns, validation | To fill |

---

## Pre-Development Checklist

- For shared, Mobile, site, or future Desktop presentation work, read
  [Directory Structure](./directory-structure.md) and
  [Component Guidelines](./component-guidelines.md).
- For payload or persistence work, also read the shared cross-layer guide and
  the package that owns the relevant contract. For mobile settings persistence,
  read [State Management](./state-management.md).
- For mobile user-facing text, locale-sensitive formatting, or native metadata,
  read [Localization Guidelines](./localization-guidelines.md).
- For app version, backend User-Agent, Expo config, or iOS build metadata,
  read [Build Compatibility Version](./build-version-contract.md).

## Quality Check

- Run workspace type checks and the package-boundary check.
- Before reporting completion, read the **Testing Requirements** section of
  [Quality Guidelines](./quality-guidelines.md): simulator/device interaction
  smoke tests are user-accepted unless the user explicitly asked the agent to
  drive the simulator; everything else is self-verified by the agent.

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
