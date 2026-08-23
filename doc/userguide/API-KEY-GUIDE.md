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
- `EDITARTICLE`: Allows updating or deleting articles
- `ADDREACTION`: Allows adding reactions to notes
- `DELETEREACTION`: Allows deleting reactions from notes
- `EDITPROFILE`: Allows getting and updating user profile
- `UPLOADATTACHMENT`: Allows requesting presigned URLs and finalizing attachment uploads
- `DELETEATTACHMENT`: Allows deleting attachments

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

### 2. Create Note (Legacy/Compatibility)

**Endpoints**:

- `GET /v2/api/openkey/notes/create`
- `POST /v2/api/openkey/notes/create`

Both compatibility endpoints remain available, but new integrations should use
`POST /v2/api/openkey/notes`. Successful compatibility responses include:

- `Deprecation: true`
- `Link: </v2/api/openkey/notes>; rel="successor-version"`

The legacy POST endpoint accepts the same JSON body as the recommended POST endpoint.
The legacy GET endpoint accepts these query parameters:

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)
- `content`: Note content (required, max 1,000,000 characters)
- `state`: Note state (private or public, defaults to private)
- `type`: Note type (defaults to `rote`)
- `title`: Optional title
- `tag`: Tags (can be multiple, e.g., `tag=tag1&tag=tag2`, each tag max 50 characters, max 20 tags)
- `pin`: Whether to pin the note (`true`, `false`, `1`, or `0`)
- `archived`: Whether to archive the note (`true`, `false`, `1`, or `0`)
- `articleId`: Optional article ID to bind

Other boolean values are rejected with HTTP 400.

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

### 4. Retrieve Article By ID

**Endpoint**: `GET /v2/api/openkey/articles/:id`

**Path Parameters**:

- `id`: The UUID of the article

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)

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
    "updatedAt": "...",
    "note": {
      /* Attached Note Object if available */
    }
  }
}
```

**Required Permission**: None (Valid API Key required)

### 5. Update Article

**Endpoint**: `PUT /v2/api/openkey/articles/:id`

**Headers**:

- `Content-Type: application/json`

**Path Parameters**:

- `id`: The UUID of the article

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "content": "Updated article content"
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "article_id",
    "content": "Updated article content",
    "authorId": "user_id",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Required Permission**: `EDITARTICLE`

### 6. Delete Article

**Endpoint**: `DELETE /v2/api/openkey/articles/:id`

**Path Parameters**:

- `id`: The UUID of the article

**Query Parameters**:

- `openkey`: YOUR_API_KEY (Required)

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

**Required Permission**: `EDITARTICLE`

### 7. Retrieve Notes

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

### 8. Search Notes

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

### 9. Add Reaction

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

### 10. Remove Reaction

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

### 11. Get Profile

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
    "certified": true,
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

### 12. Update Profile

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

### 13. Check Permissions

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

### 14. Presign Attachment Upload

**Endpoint**: `POST /v2/api/openkey/attachments/presign`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "files": [
    {
      "filename": "image.jpg",
      "contentType": "image/jpeg",
      "size": 12345
    }
  ]
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "uuid": "attachment_uuid",
        "original": {
          "key": "users/user_id/uploads/attachment_uuid.jpg",
          "putUrl": "https://presigned-url-for-upload",
          "url": "https://public-url",
          "contentType": "image/jpeg"
        },
        "compressed": {
          "key": "users/user_id/compressed/attachment_uuid.webp",
          "putUrl": "https://presigned-url-for-compressed",
          "url": "https://public-url-compressed",
          "contentType": "image/webp"
        }
      }
    ]
  }
}
```

**Required Permission**: `UPLOADATTACHMENT`

### 15. Finalize Attachment Upload

**Endpoint**: `POST /v2/api/openkey/attachments/finalize`

**Headers**:

- `Content-Type: application/json`

**Request Body**:

```json
{
  "openkey": "YOUR_API_KEY",
  "attachments": [
    {
      "uuid": "attachment_uuid",
      "originalKey": "users/user_id/uploads/attachment_uuid.jpg",
      "compressedKey": "users/user_id/compressed/attachment_uuid.webp",
      "size": 12345,
      "mimetype": "image/jpeg",
      "hash": "optional_hash"
    }
  ]
}
```

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "attachment_uuid",
      "originalKey": "users/user_id/uploads/attachment_uuid.jpg",
      "mimetype": "image/jpeg"
    }
  ]
}
```

**Required Permission**: `UPLOADATTACHMENT`

### 16. Delete Attachment

**Endpoint**: `DELETE /v2/api/openkey/attachments/:id`

**Path Parameters**:

- `id`: The UUID of the attachment

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

**Required Permission**: `DELETEATTACHMENT`

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

### 17. Monitoring API Key Usage

You can retrieve usage logs for a specific API Key to monitor its activity.

**Endpoint**: `GET /v2/api/api-keys/:id/logs`

**Headers**:

- `Authorization: Bearer <accessToken>` (Required, must be the owner of the API Key)
- `Content-Type: application/json`

**Path Parameters**:

- `id`: The UUID of the API Key

**Query Parameters**:

- `skip`: Number of items to skip (pagination, default 0)
- `limit`: Maximum number of items to return (pagination, default 50)

**Response**:

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "log_uuid",
      "openKeyId": "api_key_uuid",
      "endpoint": "/v2/api/openkey/notes",
      "method": "POST",
      "clientIp": "127.0.0.1",
      "userAgent": "PostmanRuntime/7.26.8",
      "statusCode": 201,
      "responseTime": 45,
      "errorMessage": null,
      "createdAt": "2025-05-27T10:30:00Z"
    }
  ]
}
```

**Required Permission**: Authenticated user must be the owner of the API Key.
