# Product

<!-- impeccable:product-schema 1 -->

## Platform

web, mobile (Android APK via Capacitor)

## Users
Soteiro and family members with ADHD / neurodivergent focus needs. They require a low-friction, high-clarity personal OS to organize daily tasks, projects, schedules, personal finances, and knowledge without feeling overwhelmed.

## Product Purpose
Cassandra is a unified personal HQ & intelligent command center. It unifies daily scheduling, task and project management, financial overview (Actual Budget), basic CRM, and information gathering into a self-hosted web application (Go + Angular, PostgreSQL on Hetzner), building toward an integrated AI agent layer ("Gandalf").

## Positioning
A self-hosted, single-binary personal OS tailored specifically for neurodivergent (ADHD) task and life management—combining local data ownership, external service integrations (TickTick, Google Calendar, email), and AI agent workflows in one cohesive system.

## Operating Context
- Daily planning, task execution, project tracking, and focus blocks.
- Centralizing fragmented tools (Google Calendar, TickTick, Aurora email migration, Actual Budget).
- Shared deployment for family members requiring low-cognitive-load UI/UX.

## Capabilities and Constraints
- **Stack**: Angular 22 + Tailwind CSS v4 (Frontend), Go + PostgreSQL on Hetzner (Backend).
- **Multi-user**: Multi-user authentication & authorization architecture to support family members.
- **Phased Implementation**:
  - *Phase 1 (Immediate Focus)*: Tasks & Projects management module.
  - *Phase 2*: Calendar & event integrations (TickTick + Google Calendar).
  - *Phase 3*: Financial overview & Actual Budget integration.
  - *Phase 4*: Basic CRM & email ingestion (migrated from project Aurora).
  - *Phase 5*: Knowledge center & AI agent layer ("Gandalf").

## Brand Commitments
- Name: Cassandra.
- Identity: Minimal cognitive load, high clarity, structured focus mode.

## Evidence on Hand
- Architecture and vision in `memoria.md`.
- Mobile architecture, environments & CORS in `docs/ARQUITECTURA_Y_APK.md`.
- Initial database and backend roadmap in `tareas.md`.
- Codebase in `frontend/` (Angular 22) and `backend/` (Go).

## Product Principles
- **Cognitive Clarity First**: Minimize visual distraction, task overhead, and context switching.
- **Incremental Depth**: Deliver an exceptional Tasks & Projects foundation before expanding into secondary modules.
- **Unified Command**: Aggregate external schedules, tasks, and data into a single source of truth.
- **Privacy & Ownership**: Self-hosted on Hetzner, packaged as a single deployable release.

## Accessibility & Inclusion
Designed for ADHD accessibility: clear visual hierarchy, minimal visual clutter, high contrast focus states, explicit progress tracking, and low-friction inputs.
