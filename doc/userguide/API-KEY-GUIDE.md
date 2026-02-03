# API Key Usage Guide

## Introduction

The API Key (OpenKey) feature allows external applications to interact with the Rote platform programmatically without requiring user login. This document provides detailed information on how to use API Keys to create and retrieve notes.

## Authentication

All API Key requests must include the `openkey` parameter. This can be done in two ways:

1.  **Query Parameter** (Recommended for GET requests):
    `https://your-api-url/v2/api/openkey/endpoint?openkey=YOUR_API_KEY`

2.  **Request Body** (Recommended for POST/PUT/DELETE requests):
    Include `"openkey": "YOUR_API_KEY"` in the JSON body.

## Permissions

API Keys can have the following permissions:

- `SENDROTE`: Allows creating notes
- `GETROTE`: Allows retrieving notes
- `EDITROTE`: Allows editing and deleting notes
- `SENDARTICLE`: Allows creating articles
- `ADDREACTION`: Allows adding reactions to notes
- `DELETEREACTION`: Allows deleting reactions from notes
- `EDITPROFILE`: Allows getting and updating user profile

When generating or updating an API Key, you can specify which permissions it should have.

## Endpoints

### 1. Create Note (POST method - Recommended)

**Endpoint**: `POST /v2/api/openkey/notes`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "content": "Note content (required, max 1,000,000 characters)",
  "title": "Optional title (max 200 characters)",
  "state": "private|public",
  "type": "rote|article|other",
  "tags": ["tag1", "tag2"], // Each tag max 50 characters, max 20 tags
  "pin": false,
  "articleId": "optional-article-uuid" // Bind to an existing article
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "note_id",
    "content": "Note content",
    "title": "Optional title",
    "state": "private",
    "type": "rote",
    "tags": ["tag1", "tag2"],
    "pin": false,
    "authorid": "user_id",
    "createdAt": "2025-05-27T10:30:00Z",
    "updatedAt": "2025-05-27T10:30:00Z"
  }
}
```

**Required Permission**: `SENDROTE`

### 2. Create Note (GET method - Legacy/Compatibility)

**Endpoint**: `GET /v2/api/openkey/notes/create`

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)
- `content`: Note content (required, max 1,000,000 characters)
- `state`: Note state (private or public, defaults to private)
- `type`: Note type (defaults to "Rote")
- `title`: Optional title
- `tag`: Tags (can be multiple, e.g., `tag=tag1&tag=tag2`, each tag max 50 characters, max 20 tags)
- `pin`: Whether to pin the note (true/false)
- `articleId`: Optional article ID to bind

**Response**: Same as POST method

**Required Permission**: `SENDROTE`

### 3. Create Article

**Endpoint**: `POST /v2/api/openkey/articles`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "content": "Article content (required)"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "article_id",
    "content": "Article content",
    "authorId": "user_id",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Required Permission**: `SENDARTICLE`

### 4. Retrieve Notes

**Endpoint**: `GET /v2/api/openkey/notes`

**Headers**:

- `Content-Type: application/json`

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)
- `skip`: Number of items to skip (pagination)
- `limit`: Maximum number of items to return (pagination)
- `archived`: Whether to include archived notes (true/false)
- `tag`: Tag filter, supports `tag` or `tag[]` format (multiple tags use `hasEvery` logic - notes must contain all specified tags)
- _Note_: Any other query parameters provided will be used as exact match filters against note fields.

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "note_id_1",
      "content": "Note content 1",
      "title": "Note title 1",
      "state": "private",
      "type": "rote",
      "tags": ["tag1"],
      "pin": false,
      "authorid": "user_id",
      "createdAt": "2025-05-27T10:30:00Z",
      "updatedAt": "2025-05-27T10:30:00Z"
    },
    {
      "id": "note_id_2",
      "content": "Note content 2",
      "title": "Note title 2",
      "state": "private",
      "type": "rote",
      "tags": ["tag2"],
      "pin": true,
      "authorid": "user_id",
      "createdAt": "2025-05-27T11:30:00Z",
      "updatedAt": "2025-05-27T11:30:00Z"
    }
  ]
}
```

**Required Permission**: `GETROTE`

### 5. Search Notes

**Endpoint**: `GET /v2/api/openkey/notes/search`

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)
- `keyword`: Search keyword (required)
- `skip`: Number of items to skip
- `limit`: Maximum number of items to return
- `archived`: include archived notes (true/false)
- `tag`: Tag filter

**Response**: Same as Retrieve Notes (list of notes)

**Required Permission**: `GETROTE`

### 6. Add Reaction

**Endpoint**: `POST /v2/api/openkey/reactions`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "type": "like",
  "roteid": "note_uuid",
  "metadata": {} // Optional
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "reaction_id",
    "type": "like",
    "roteid": "note_uuid",
    "userid": "user_id"
  }
}
```

**Required Permission**: `ADDREACTION`

### 7. Remove Reaction

**Endpoint**: `DELETE /v2/api/openkey/reactions/:roteid/:type`

**Path Parameters**:

- `roteid`: The UUID of the note
- `type`: The type of reaction to remove (e.g., "like")

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "count": 1
  }
}
```

**Required Permission**: `DELETEREACTION`

### 8. Get Profile

**Endpoint**: `GET /v2/api/openkey/profile`

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "emailVerified": true,
    "username": "username",
    "nickname": "User Nickname",
    "description": "User description",
    "avatar": "https://example.com/avatar.jpg",
    "cover": "https://example.com/cover.jpg",
    "role": "user",
    "createdAt": "2025-05-27T10:30:00Z",
    "updatedAt": "2025-05-27T10:30:00Z",
    "allowExplore": true,
    "oauthBindings": []
  }
}
```

**Required Permission**: `EDITPROFILE`

### 9. Update Profile

**Endpoint**: `PUT /v2/api/openkey/profile`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "nickname": "New Nickname",
  "description": "New description",
  "avatar": "https://example.com/new-avatar.jpg",
  "cover": "https://example.com/new-cover.jpg",
  "username": "newusername"
}
```

All fields are optional. Username validation:

- 1-20 characters
- Only letters, numbers, underscores and hyphens allowed
- Cannot conflict with system routes

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "newusername",
    "nickname": "New Nickname",
    "description": "New description",
    "avatar": "https://example.com/new-avatar.jpg",
    "cover": "https://example.com/new-cover.jpg",
    "role": "user",
    "createdAt": "2025-05-27T10:30:00Z",
    "updatedAt": "2025-05-27T10:30:00Z"
  }
}
```

**Required Permission**: `EDITPROFILE`

### 10. Check Permissions

**Endpoint**: `GET /v2/api/openkey/permissions`

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissions": ["SENDROTE", "GETROTE"]
  }
}
```

**Required Permission**: None (Valid API Key required)

## Error Handling

API errors are returned with appropriate HTTP status codes and a JSON response with error details.

Example error response:

```json
{
  "code": 1,
  "message": "API key permission does not match",
  "data": null
}
```

Common error codes:

- 401: Invalid or expired API key
- 403: Insufficient permissions
- 400: Missing required parameters or invalid request
- 400: Input length exceeds limit (title > 200 chars, content > 1,000,000 chars, tag > 50 chars, or > 20 tags)
