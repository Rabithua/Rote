# API Key Usage Guide

## Introduction

The API Key (OpenKey) feature allows external applications to interact with the Rote platform programmatically without requiring user login. This document provides detailed information on how to use API Keys to create and retrieve notes.

## Authentication

All API Key requests must include the API key in the request header:

```
Authorization: Bearer YOUR_API_KEY
```

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
- `Authorization: Bearer YOUR_API_KEY`

**Request Body**:

```json
{
  "content": "Note content (required, max 1,000,000 characters)",
  "title": "Optional title (max 200 characters)",
  "state": "private|public",
  "type": "rote|article|other",
  "tags": ["tag1", "tag2"], // Each tag max 50 characters, max 20 tags
  "pin": false
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

**Endpoint**: `GET /v2/api/openkey/notes`

**Headers**:

- `Authorization: Bearer YOUR_API_KEY`

**Query Parameters**:

- `content`: Note content (required, max 1,000,000 characters)
- `state`: Note state (private or public, defaults to private)
- `type`: Note type (defaults to "rote")
- `tag`: Tags (can be multiple, e.g., `tag=tag1&tag=tag2`, each tag max 50 characters, max 20 tags)
- `pin`: Whether to pin the note (true/false)

**Response**: Same as POST method

**Required Permission**: `SENDROTE`

### 3. Retrieve Notes

**Endpoint**: `GET /v2/api/openkey/notes`

**Headers**:

- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY`

**Query Parameters**:

- `skip`: Number of items to skip (pagination)
- `limit`: Maximum number of items to return (pagination)
- `archived`: Whether to include archived notes (true/false)
- `tag`: Tag filter, supports `tag` or `tag[]` format (multiple tags use `hasEvery` logic - notes must contain all specified tags)

**Request Body** (optional filter):

```json
{
  "filter": {
    "searchText": "search term",
    "tags": ["tag1", "tag2"]
  }
}
```

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

### 4. Get Profile

**Endpoint**: `GET /v2/api/openkey/profile`

**Headers**:

- `Authorization: Bearer YOUR_API_KEY`

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

### 5. Update Profile

**Endpoint**: `PUT /v2/api/openkey/profile`

**Headers**:

- `Content-Type: application/json`
- `Authorization: Bearer YOUR_API_KEY`

**Request Body**:

```json
{
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

## Code Examples

### JavaScript/Node.js

```javascript
// Create note example
async function createNote() {
  const response = await fetch("https://your-api-url/v2/api/openkey/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer YOUR_API_KEY",
    },
    body: JSON.stringify({
      content: "This is a test note created via API",
      title: "API Test",
      state: "private",
      tags: ["api", "test"],
    }),
  });

  const data = await response.json();
  console.log(data);
}

// Get notes example
async function getNotes() {
  const response = await fetch(
    "https://your-api-url/v2/api/openkey/notes?limit=10&skip=0",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer YOUR_API_KEY",
      },
    },
  );

  const data = await response.json();
  console.log(data);
}
```

### Python

```python
import requests
import json

# Create note example
def create_note():
    url = "https://your-api-url/v2/api/openkey/notes"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_KEY"
    }
    payload = {
        "content": "This is a test note created via API",
        "title": "API Test",
        "state": "private",
        "tags": ["api", "test"]
    }

    response = requests.post(url, headers=headers, json=payload)
    print(response.json())

# Get notes example
def get_notes():
    url = "https://your-api-url/v2/api/openkey/notes?limit=10&skip=0"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_KEY"
    }

    response = requests.get(url, headers=headers)
    print(response.json())
```

## Best Practices

1. **Secure Your API Keys**: Treat API keys as sensitive credentials and never expose them in client-side code.
2. **Use Specific Permissions**: Only assign the permissions that your application needs.
3. **Rate Limit Your Requests**: Avoid sending too many requests in a short period.
4. **Handle Errors Properly**: Implement proper error handling for failed requests.
5. **Use POST for Creating Notes**: Prefer the POST method over the GET method for creating notes.

## Managing API Keys

You can manage your API keys through the web interface:

1. Navigate to the API Keys section in your account settings
2. Create new API keys with specific permissions
3. Update or delete existing API keys
4. View your API key usage history
