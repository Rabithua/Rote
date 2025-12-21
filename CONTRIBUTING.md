<p align="right">English | <a href="doc/CONTRIBUTING.zh.md">中文</a></p>

# Contributing to Rote

Thank you for your interest in the Rote project! We welcome contributions of all kinds.

## Ways to Contribute

### Report Bugs

If you discover a bug, please:

1. Check [Issues](https://github.com/Rabithua/Rote/issues) to see if the issue already exists
2. If not, create a new Issue with:
   - A clear description of the bug
   - Steps to reproduce
   - Expected behavior vs actual behavior
   - Environment information (OS, browser, version, etc.)

> **Important**: If you discover a **security vulnerability** (especially high-risk vulnerabilities involving data breaches), please do not report it in a public Issue. Please follow the guidelines in [SECURITY.md](SECURITY.md) and report it via email or GitHub Security Advisory. Thank you very much.

### Suggest Features

We welcome feature suggestions! Please:

1. Check if there are similar feature requests
2. Create a Feature Request Issue describing:
   - Use cases for the feature
   - Why this feature would be valuable to users
   - Consider whether the feature aligns with Rote's core characteristics
   - Possible implementation approach (optional)

### Submit Pull Requests

1. **Fork the project** and create your feature branch

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Write code** following the project's code standards

3. **Commit your changes**

   ```bash
   git commit -m "Add some amazing feature"
   ```

4. **Push to your branch**

   ```bash
   git push origin feature/amazing-feature
   ```

5. **Create a Pull Request**

### Improve Documentation

Documentation improvements are equally important! You can:

- Fix spelling errors
- Improve document clarity
- Add missing documentation
- Translate documentation to other languages
- For backend API changes, synchronize updates to API documentation in the `doc` directory

### Help with Translation

Rote supports multiple languages, and we welcome translation contributions:

- Translation files are located in the `web/src/locales/` directory
- Currently supports Chinese (zh.json) and English (en.json)
- Please ensure you understand the language context you're contributing to, avoiding simple machine translations

## Code Standards

### General Standards

- **Runtime**: Use Bun as the JavaScript runtime
- **Package Management**: Use `bun install` to install dependencies and `bun run` to execute scripts
- **Code Quality**: Follow ESLint configuration rules, run `bun run lint` before committing
- **Comment Language**: Use Chinese for code comments to facilitate team understanding
- **Naming Conventions**: Use English camelCase for variable and function names
- **Code Organization**: Avoid overly long files, keep each file under 200 lines
- **Logic Simplification**: Prioritize simplified logic when implementing features, avoid over-complication
- **Code Reuse**: Reuse functions and components to reduce duplicate code

### Backend Development Standards

- **Framework**: Use Hono as the web framework
- **Database**: Use Drizzle ORM to operate PostgreSQL
- **Route Organization**: API routes v2, all placed in the `route/` directory
- **Middleware**: All middleware files are placed in the `middleware/` directory
- **Utility Functions**: Common utility functions are placed in the `utils/` directory
- **Type Definitions**: TypeScript type definitions are placed in the `types/` directory

### Frontend Development Standards

- **Build Tool**: Use Vite as the frontend build tool
- **UI Components**: Use Shadcn UI + Tailwind CSS to build interfaces
- **Component Organization**: Page-level components are placed in the `pages/` directory, reusable components are placed in the `components/` directory
- **State Management**: Use `jotai` for state management
- **Network Requests**: Use methods encapsulated in `web/src/utils/api.ts`
- **Internationalization**: Must consider internationalization support when implementing frontend features
- **Tailwind CSS**: Always use Tailwind v4, do not use v3

### API Design Standards

- **Design Principles**: Strictly follow RESTful API design principles
- **Error Handling**: Implement unified error handling mechanisms and standardized response formats
- **Authentication**: Use API Key-based security authentication mechanism

## Development Workflow

### Setting Up Development Environment

1. **Clone the project**

   ```bash
   git clone https://github.com/Rabithua/Rote.git
   cd Rote
   ```

2. **Install dependencies**

   ```bash
   # Backend
   cd server
   bun install

   # Frontend
   cd web
   bun install
   ```

3. **Configure environment variables**

   - Backend: Create a `.env` file in the `server/` directory and configure the database connection:

     ```bash
     # Local development database connection string
     POSTGRESQL_URL=postgresql://rote:rote_password_123@localhost:5433/rote
     ```

     `POSTGRESQL_URL` is a PostgreSQL database connection string with the format:
     `postgresql://username:password@host:port/database`

   - Frontend: Configure `VITE_API_BASE` environment variable (optional, defaults to `http://localhost:18000`)

4. **Start development database**

   Use Docker to start a local PostgreSQL database:

   ```bash
   cd server
   bun run db:start
   ```

   This will start a Docker container named `rote-postgres-local` with the following database configuration:

   - User: `rote`
   - Password: `rote_password_123`
   - Database: `rote`
   - Port: `5433`

   If you need to reset the database, you can use:

   ```bash
   bun run db:reset
   ```

5. **Run database migrations**

   On first startup, you need to run database migrations. Choose based on your needs:

   **Method 1: Use migration files (Recommended for initial setup)**

   ```bash
   cd server
   bun run db:migrate:programmatic
   ```

   Or use drizzle-kit CLI:

   ```bash
   bun run db:migrate
   ```

   **Method 2: Quick schema sync (For rapid iteration during development)**

   ```bash
   bun run db:push
   ```

   > **Note**: `db:push` directly syncs the schema to the database without generating migration files, suitable for rapid iteration in development environments. Production environments should use migration files.

6. **Start development servers**

   ```bash
   # Backend
   cd server
   bun run dev

   # Frontend
   cd web
   bun run dev
   ```

### Commit Standards

Commit messages should clearly describe the changes, use English:

- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `style: Code formatting changes`
- `refactor: Code refactoring`
- `test: Add tests`
- `chore: Build/toolchain related`

## Testing

Before submitting a PR, please ensure:

- Code passes ESLint checks: `bun run lint`
- Code builds successfully:
  - Backend: `cd server && bun run build`
  - Frontend: `cd web && bun run build`
- Features work correctly
- No existing functionality is broken
- Responsive layout testing: If frontend UI changes are involved, please test at different screen sizes:
  - Mobile (phone): 320px - 768px
  - Tablet: 768px - 1024px
  - Desktop: 1024px and above
  - Ensure the interface displays correctly on different devices without layout issues or element overflow

## Feedback

If you encounter any issues during contribution, you can:

- Ask questions in [Issues](https://github.com/Rabithua/Rote/issues)
- Check project documentation for more information

Thank you again for contributing to the Rote project!
