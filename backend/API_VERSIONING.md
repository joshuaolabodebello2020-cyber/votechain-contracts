# VoteChain API Versioning Strategy

## Overview
The VoteChain API follows a semantic versioning scheme to ensure stability and backward compatibility for external integrators.

## Versioning Scheme
- **URL Path Versioning**: The API version is included in the URL path (e.g., `/api/v1/proposals`)
- **Current Stable Version**: `v1`
- **OpenAPI Specification**: The authoritative contract is at [api/openapi.yml](/api/openapi.yml)

## Versioned Routes
All API endpoints are prefixed with their respective version:
- `/api/v1/*`: Current stable API (v1)
- `/api/v1/openapi.yml`: OpenAPI 3.1 specification for v1
- `/api/v1/openapi.json`: OpenAPI 3.1 specification for v1 (JSON format)

## Backward Compatibility
- Breaking changes will result in a new version number (e.g., `/api/v2`)
- The previous version will remain available for a deprecation period
- Non-breaking changes will be released under the same version number
  - Adding new endpoints
  - Adding optional parameters or fields
  - Adding new response fields

## Deprecation Policy
- When a version is deprecated, a notice will be placed in the API documentation
- Deprecated versions will receive critical security fixes only
- The deprecation period is at least 6 months from the announcement date

## Validation
All requests and responses are validated against the OpenAPI specification using `express-openapi-validator`. This ensures:
- Request parameters, bodies, and headers conform to the spec
- Response formats and status codes conform to the spec
- Clear error messages are returned for invalid requests

## Getting Started
1. Check out the OpenAPI spec at `/api/v1/openapi.yml`
2. Use tools like Postman or OpenAPI Generator to interact with the API
3. Always specify the version in your requests

## Contributing
- All new features should be added to the current version (`v1`) unless they are breaking
- When adding new endpoints, update [api/openapi.yml](/api/openapi.yml) first
- Follow the existing patterns for request/response envelopes
