# Copilot Instructions for Rote Project

## Project Overview

Rote is an open-source personal note repository system with a decoupled frontend-backend architecture, supporting open APIs, user data autonomy, and one-click Docker deployment.

### Core Features:

- Note Management: Create, edit, delete, archive
- Classification System: Tag management and categorization
- File Processing: Attachment upload and management
- Security Control: User authentication and permission management
- Search Function: Search and filtering mechanisms
- Open Interface: RESTful API support
- Data Migration: Import and export functionality
- UI Themes: Dark/light mode switching
- Multilingual: Internationalization support

## Technology Stack

- **Runtime Environment**: Bun (Node.js alternative with faster performance)
- **Backend Technology**: Bun + TypeScript + Express + Prisma + MongoDB
- **Frontend Technology**: React + TypeScript + Vite + Tailwind CSS + Radix UI
- **Data Storage**: MongoDB (database) + AWS S3/R2 (file storage)
- **Deployment**: Docker containerized deployment

## Code Standards & Guidelines

### General Standards

- Runtime: Use Bun as JavaScript runtime for faster startup and execution performance
- Package Management: Use `bun install` for dependencies, `bun run` for scripts
- Code Quality: Follow ESLint configuration rules and best practices
- React Standards: Prioritize functional components and React Hooks
- Comment Language: Use Chinese for code comments to facilitate team understanding
- Naming Convention: Use English camelCase for variable and function names
- Code Organization: Avoid overly long files, keep each file under 200 lines, split components and functions appropriately
- Logic Simplification: Prioritize `simplified logic, avoid over-complexity` when implementing features
- Code Reuse: Reuse functions and components extensively, reduce duplicate code, improve maintainability
- Testing Strategy: No need to write tests unless explicitly specified
- Internationalization: Frontend implementations must consider i18n support for multilingual compatibility
- Documentation Style: Keep documentation concise and clear, focus on core content, avoid emojis, use other symbols for readability enhancement

### Backend Development Standards (Bun + Express)

- Runtime Environment: Use Bun as JavaScript runtime for enhanced execution performance
- Database Operations: Use Prisma as ORM for unified MongoDB database operations
- Route Organization: API routes are divided into v1 and v2 versions, placed in `route/` directory
- Middleware Management: All middleware files placed in `middleware/` directory
- Utility Functions: Common utility functions placed in `utils/` directory
- Type Definitions: TypeScript type definitions placed in `types/` directory
- Session Management: Use express-session for user session management
- Authentication: Use passport for user authentication and authorization
- Security Control: Implement API rate limiting to prevent abuse
- File Storage: Support file uploads to AWS S3/R2 cloud storage services

### Frontend Development Standards (React + TypeScript)

- Build Tool: Use Vite as frontend build tool for fast development experience
- UI Components: Use Radix UI + Tailwind CSS for modern interface construction
- Component Organization: Page-level components in `pages/` directory, reusable components in `components/` directory
- State Management: Use `jotai` for state management
- Network Requests: Use pre-wrapped methods in `frontend/src/utils/api.ts` for unified API requests
- Internationalization: Support multilingual (i18n), language config files in `locales/` directory
- Design System: Use shadcn/ui component system for interface consistency

### API Design Standards

- Design Principles: Strictly follow RESTful API design principles and best practices
- Error Handling: Implement unified error handling mechanisms and standardized response formats
- Feature Support: Comprehensive support for pagination, conditional search, data filtering
- Documentation Maintenance: API documentation maintained in `backend/doc/` directory
- Authentication Mechanism: Implement API Key-based secure authentication

## File Structure Conventions

### Backend Structure

```
backend/
├── server.ts           # Main server file
├── route/             # API routes
├── middleware/        # Middleware
├── utils/            # Utility functions
├── types/            # Type definitions
├── prisma/           # Database schema
├── scripts/          # Scripts
└── schedule/         # Scheduled tasks
```

### Frontend Structure

```
frontend/
├── src/
│   ├── pages/        # Page components
│   ├── components/   # Reusable components
│   ├── layout/       # Layout components
│   ├── utils/        # Utility functions
│   ├── state/        # State management
│   ├── types/        # Type definitions
│   └── locales/      # Internationalization files
```

## Development Guidelines

### Backend Development Guide:

- Service Startup: Use `bun run dev` to start backend development server
- Database Migration: Use `bun run dbSchemaUpdate` to update database schema
- Dependency Management: Use `bun install` to install project dependencies
- API Development: Must add corresponding TypeScript type definitions and complete error handling when adding new API endpoints
- Documentation Maintenance: Must update API documentation in `backend/doc/` directory when adding new APIs
- Response Standards: Ensure all API endpoints return consistent response formats

### Frontend Development Guide:

- Service Startup: Use `bun run dev` to start frontend development server
- Dependency Management: Use `bun install` to install frontend dependencies
- Route Configuration: Must add corresponding route rules when adding new page components
- Design Standards: Component design must strictly follow `shadcn UI` + `Tailwind CSS` design system
- User Experience: Ensure responsive design and complete accessibility support

### Testing & Deployment Guide:

- Local Testing: Use Docker for local environment testing and containerized deployment
- Configuration Reference: Refer to `docker-compose-example.yml` in project root for environment configuration
- Environment Variables: Ensure all necessary environment variables are properly configured and available
