# REST API Restructuring Documentation

## Background

The original API interface had the following issues:

1. Inconsistent URL naming styles (mix of camelCase, snake_case, and kebab-case)
2. Non-standard use of HTTP methods (using POST to retrieve resources)
3. Resource naming that does not comply with RESTful conventions
4. Inconsistent response formats
5. Unclear interface path structure

## Restructuring Principles

### 1. Unified Naming Conventions

- Use all lowercase words, with multiple words separated by hyphens (kebab-case)
- Use plural forms for resource names

### 2. Standardized HTTP Method Usage

- GET: Retrieve resources
- POST: Create resources
- PUT: Update resources (complete replacement)
- PATCH: Partially update resources
- DELETE: Delete resources

### 3. Structured Resource Organization

Use nested structures to express relationships between resources, such as:

- `/users/{userId}/notes`: Retrieve all notes from a specific user
- `/notes/{noteId}/attachments`: Retrieve all attachments of a specific note

### 4. Unified Response Format

```typescript
{
  "code": 0,         // Business status code, 0 indicates success
  "message": "...",  // Status description
  "data": { ... }    // Business data
}
```

### 5. Appropriate Use of HTTP Status Codes

- 200: Success
- 201: Created successfully
- 400: Request error
- 401: Unauthorized
- 403: Forbidden
- 404: Resource not found
- 500: Server error

## New vs. Old API Comparison

| Original API               | New API                     | HTTP Method | Description                   |
| -------------------------- | --------------------------- | ----------- | ----------------------------- |
| `/ping`                    | `/health`                   | GET         | Health check                  |
| `/register`                | `/auth/register`            | POST        | User registration             |
| `/login/password`          | `/auth/login`               | POST        | User login                    |
| `/logout`                  | `/auth/logout`              | POST        | User logout                   |
| `/change/password`         | `/auth/password`            | PUT         | Change password               |
| `/profile` (GET)           | `/users/me/profile`         | GET         | Get current user profile      |
| `/profile` (POST)          | `/users/me/profile`         | PUT         | Update current user profile   |
| `/getUserInfo`             | `/users/:username`          | GET         | Get user information          |
| `/getMySession`            | `/users/me/sessions`        | GET         | Get current user sessions     |
| `/getMyTags`               | `/users/me/tags`            | GET         | Get current user tags         |
| `/getMyHeatmap`            | `/users/me/heatmap`         | GET         | Get user heatmap data         |
| `/statistics`              | `/users/me/statistics`      | GET         | Get user statistics           |
| `/exportData`              | `/users/me/export`          | GET         | Export user data              |
| `/addRote`                 | `/notes`                    | POST        | Create note                   |
| `/oneRote` (GET)           | `/notes/:id`                | GET         | Get note details              |
| `/oneRote` (POST)          | `/notes/:id`                | PUT         | Update note                   |
| `/oneRote` (DELETE)        | `/notes/:id`                | DELETE      | Delete note                   |
| `/getMyRote`               | `/notes`                    | GET         | Get current user's notes list |
| `/getUserPublicRote`       | `/notes/users/:username`    | GET         | Get user's public notes       |
| `/getPublicRote`           | `/notes/public`             | GET         | Get all public notes          |
| `/randomRote`              | `/notes/random`             | GET         | Get random note               |
| `/notice`                  | `/notifications`            | POST        | Create notification           |
| `/addSwSubScription`       | `/subscriptions`            | POST        | Add subscription              |
| `/swSubScription` (GET)    | `/subscriptions`            | GET         | Get user subscriptions        |
| `/swSubScription` (DELETE) | `/subscriptions/:id`        | DELETE      | Delete subscription           |
| `/sendSwSubScription`      | `/subscriptions/:id/notify` | POST        | Send notification             |
| `/openkey/generate`        | `/api-keys`                 | POST        | Generate API key              |
| `/openkey` (GET)           | `/api-keys`                 | GET         | Get all API keys              |
| `/openkey` (POST)          | `/api-keys/:id`             | PUT         | Update API key                |
| `/openkey` (DELETE)        | `/api-keys/:id`             | DELETE      | Delete API key                |
| `/upload`                  | `/attachments`              | POST        | Upload attachment             |
| `/deleteAttachment`        | `/attachments/:id`          | DELETE      | Delete single attachment      |
| `/deleteAttachments`       | `/attachments`              | DELETE      | Delete multiple attachments   |
| `/sitemapData`             | `/site/sitemap`             | GET         | Get sitemap data              |
| `/status`                  | `/site/status`              | GET         | Get site status               |
| `/rss/:username`           | `/users/:username/rss`      | GET         | Get user RSS                  |

## API Key Interface Restructuring

| Original API              | New API           | HTTP Method | Description                               |
| ------------------------- | ----------------- | ----------- | ----------------------------------------- |
| `/openKey/onerote` (GET)  | `/open-key/notes` | GET         | Create note using API key (compatibility) |
| `/openKey/onerote` (POST) | `/open-key/notes` | POST        | Create note using API key                 |
| `/openKey/myrote`         | `/open-key/notes` | GET         | Get notes using API key                   |

## Migration Recommendations

1. Keep the original v1 interface for a period while providing the new v2 interface
2. Clearly document the deprecation plan for v1 interfaces and how to use v2 interfaces
3. Gradually migrate the frontend to v2 interfaces
4. Set a reasonable transition period and timeline for completely removing v1 interfaces

## Future Optimization Directions

1. Consider introducing API version control headers (Accept-Version or custom headers)
2. Improve error handling and error code system
3. Implement parameter validation middleware to ensure request data validity
4. Add rate limiting for APIs to prevent abuse
5. Add API documentation, such as using Swagger or OpenAPI specifications to auto-generate documentation
