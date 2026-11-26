# express-zod-validations

[![npm version](https://badge.fury.io/js/express-zod-validations.svg)](https://www.npmjs.com/package/express-zod-validations)
[![Publish](https://github.com/mattiamalonni/express-zod-validations/actions/workflows/publish.yml/badge.svg)](https://github.com/mattiamalonni/express-zod-validations/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

Type-safe Express middleware for validating requests using [Zod](https://github.com/colinhacks/zod).

## Features

- 🛡️ **Type-safe validation** - Full TypeScript support with Zod schemas
- ⚡ **Sync by default** - Uses `safeParse`; `validateAsync` helpers cover async transformations
- 🎯 **Granular validation** - Validate body, params, query, and headers independently
- 🔧 **Flexible error handling** - Choose between storing or throwing validation errors
- 📦 **Zero config** - Works out of the box with sensible defaults

## Installation

```bash
npm install express-zod-validations zod express
```

## Quick Start

```typescript
import express from 'express';
import { z } from 'zod';
import { validateBody, type ValidationRequest } from 'express-zod-validations';

const app = express();
app.use(express.json());

// Define your schema
const userSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  age: z.number().int().positive().optional(),
});

// Annotate the handler to infer the validated values from the schema
app.post(
  '/users',
  validateBody(userSchema),
  (req: ValidationRequest<{ body: typeof userSchema }>, res) => {
    // Check for errors (if throwErrors is false)
    if (req.validationErrors?.body) {
      return res.status(400).json({ issues: req.validationErrors.body.issues });
    }

    // `user` is inferred as { name: string; email: string; age?: number }
    const user = req.validationValues?.body;
    res.json({ message: 'User created', user });
  },
);

app.listen(3000);
```

## Usage

### Validate Different Request Parts

```typescript
import { z } from 'zod';
import {
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
} from 'express-zod-validations';

// Body validation
app.post('/users', validateBody(z.object({ name: z.string() })), handler);

// URL params validation
app.get('/users/:id', validateParams(z.object({ id: z.uuid() })), handler);

// Query string validation
app.get(
  '/users',
  validateQuery(z.object({ page: z.coerce.number().int().min(1).default(1) })),
  handler,
);

// Headers validation
app.get(
  '/protected',
  validateHeaders(z.object({ authorization: z.string().startsWith('Bearer ') })),
  handler,
);
```

### Validate Multiple Parts at Once

```typescript
import { z } from 'zod';
import validate, { type ValidationRequest } from 'express-zod-validations';

const schemas = {
  params: z.object({ id: z.string().length(24) }),
  body: z.object({ title: z.string(), content: z.string().min(10) }),
  headers: z.object({ authorization: z.string() }),
};

app.put('/posts/:id', validate(schemas), (req: ValidationRequest<typeof schemas>, res) => {
  // All validated values are available and inferred from `schemas`
  const { params, body, headers } = req.validationValues ?? {};
  res.json({ params, body, headers });
});
```

### Chain Multiple Validators

```typescript
const authSchema = z.object({ authorization: z.string().startsWith('Bearer ') });
const idSchema = z.object({ id: z.uuid() });
const postSchema = z.object({ title: z.string(), content: z.string().min(10) });

app.put(
  '/posts/:id',
  validateHeaders(authSchema),
  validateParams(idSchema),
  validateBody(postSchema),
  postsController.update,
);
```

## Configuration

### Global Configuration

Set default behavior for all validations:

```typescript
import express from 'express';
import { expressZodValidations } from 'express-zod-validations';

const app = express();

app.use(
  expressZodValidations({
    throwErrors: true, // Throw errors instead of storing them
    overwriteRequest: true, // Replace req.body, req.params, etc. with parsed values
  }),
);
```

#### Options

- **`throwErrors`** (default: `false`)
  When `true`, validation errors are passed to `next(error)`, triggering your Express error handler.
  When `false`, errors are stored in `req.validationErrors` and execution continues.
  With `validate()` on multiple parts, only the **first** failing key is thrown, and **no** results
  are written to the request (validation is atomic).

- **`overwriteRequest`** (default: `false`)
  When `true`, replaces `req.body`, `req.params` and `req.query` with the parsed and transformed
  values from Zod. `req.headers` is **merged** rather than replaced, so standard headers such as
  `host` and `content-type` survive even when the schema strips unknown keys.
  When `false`, parsed values are stored in `req.validationValues`.
  Parsed values are always available in `req.validationValues`, regardless of this option.

### Per-Request Configuration

The global configuration is stored on the request, so any middleware placed **before** the
validator can override it for a single route:

```typescript
app.post(
  '/admin',
  (req, _res, next) => {
    (req as ValidationRequest).validationConfigs = { throwErrors: true };
    next();
  },
  validateBody(userSchema),
  handler,
);
```

The `ValidationRequest` type is imported from the package.

### Per-Route Validation Options

Pass Zod parsing options as a second parameter:

```typescript
validateBody(userSchema, {
  // Zod v4 parse option (the old Zod v3 `errorMap` no longer exists)
  error: (issue) => `Custom error: ${issue.path.join('.')}`,
});
```

### Sync vs Async Validation

`validate` and `validateBody` / `validateParams` / `validateQuery` / `validateHeaders` use Zod's
synchronous `safeParse` and return a plain middleware. When a schema contains async refinements or
transforms, use the `validateAsync` variants (`validateAsync`, `validateBodyAsync`,
`validateParamsAsync`, `validateQueryAsync`, `validateHeadersAsync`), which call `safeParseAsync`:

```typescript
import { validateBodyAsync } from 'express-zod-validations';

const userSchema = z.object({
  username: z.string().refine(async (value) => isAvailable(value), 'already taken'),
});

app.post('/users', validateBodyAsync(userSchema), handler);
```

Using an async schema with the synchronous helpers forwards Zod's
`Encountered Promise during synchronous parse` error to `next(error)`.

## Accessing Validation Results

### Validated Values

```typescript
app.post(
  '/users',
  validateBody(userSchema),
  (req: ValidationRequest<{ body: typeof userSchema }>, res) => {
    // Original request body (untransformed)
    console.log(req.body);

    // Validated and transformed data
    console.log(req.validationValues?.body);
  },
);
```

### Validation Errors

When `throwErrors` is `false`, errors are accessible via `req.validationErrors`:

```typescript
app.post('/users', validateBody(userSchema), (req: ValidationRequest, res) => {
  if (req.validationErrors?.body) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: req.validationErrors.body.issues,
    });
  }

  // Process valid data
  res.json(req.validationValues?.body);
});
```

## TypeScript Support

The middleware extends the Express `Request` type. `ValidationRequest` is generic: pass the
schemas you used so `validationValues` is inferred instead of being `unknown`. Without a type
argument the values keep their default `unknown` type.

```typescript
import { z } from 'zod';
import { validateBody, ValidationError, type ValidationRequest } from 'express-zod-validations';

const userSchema = z.object({ name: z.string(), email: z.email() });

app.post(
  '/users',
  validateBody(userSchema),
  (req: ValidationRequest<{ body: typeof userSchema }>, res) => {
    // `body` is inferred as { name: string; email: string }
    const body = req.validationValues?.body;
    req.validationErrors?.body;
    res.json(body);
  },
);

// ValidationError extends ZodError and carries the failing key
const error = new ValidationError('body', someZodError);
console.log(error.key);
```

## Error Handling

### Option 1: Store Errors (Default)

```typescript
app.post('/users', validateBody(userSchema), (req: ValidationRequest, res) => {
  if (req.validationErrors?.body) {
    // Zod v4 exposes `issues`, not the old `.errors`
    return res.status(400).json({ issues: req.validationErrors.body.issues });
  }
  // Handle valid request
});
```

### Option 2: Throw Errors

```typescript
import { ValidationError } from 'express-zod-validations';

// Enable globally
app.use(expressZodValidations({ throwErrors: true }));

// Add error handler
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    // Zod v4 exposes `issues`, not the old `.errors`
    return res.status(400).json({ key: err.key, issues: err.issues });
  }
  next(err);
});
```

## Advanced Examples

### Query String Coercion

Query parameters are always strings. Use `z.coerce` for automatic type conversion:

```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('asc'),
});

app.get(
  '/posts',
  validateQuery(paginationSchema),
  (req: ValidationRequest<{ query: typeof paginationSchema }>, res) => {
    const { page, limit, sort } = req.validationValues?.query ?? {};
    // page and limit are numbers, not strings
    res.json({ page, limit, sort });
  },
);
```

### Transform and Sanitize Data

```typescript
const createUserSchema = z.object({
  email: z.email().toLowerCase(),
  name: z.string().trim().min(2),
  bio: z
    .string()
    .trim()
    .optional()
    .transform((val) => val || null),
});

app.post(
  '/users',
  validateBody(createUserSchema),
  (req: ValidationRequest<{ body: typeof createUserSchema }>, res) => {
    // Email is lowercased, name is trimmed, empty bio becomes null
    const user = req.validationValues?.body;
    res.json(user);
  },
);
```

### Allow Unknown Fields

By default, Zod strips unknown properties. To change this:

```typescript
// Allow extra fields (Zod v4 name; `.passthrough()` still works as an alias)
const schema = z.object({ name: z.string() }).loose();

// Strict mode - error on extra fields
const strictSchema = z.object({ name: z.string() }).strict();
```

## API Reference

### Functions

- `validate(props, options?)` - Validate multiple request parts (sync)
- `validateBody(schema, options?)` - Validate request body (sync)
- `validateParams(schema, options?)` - Validate URL parameters (sync)
- `validateQuery(schema, options?)` - Validate query string (sync)
- `validateHeaders(schema, options?)` - Validate headers (sync)
- `validateAsync(props, options?)` - Validate multiple parts with `safeParseAsync`
- `validateBodyAsync(schema, options?)` - Async body validation
- `validateParamsAsync(schema, options?)` - Async params validation
- `validateQueryAsync(schema, options?)` - Async query validation
- `validateHeadersAsync(schema, options?)` - Async headers validation
- `expressZodValidations(config)` - Set global configuration

### Types

- `ValidationRequest<S>` - Extended Express Request; `S` infers `validationValues`
- `ValidationConfigs` - Configuration options type
- `ValidationErrors` - Validation errors object type
- `ValidationValues<S>` - Validated values, inferred from `S`
- `ValidationError` - Thrown error with a `key` and Zod v4 `issues`

## Development

Development uses Node 22.22 (see `.node-version`) because the `oxlint.config.ts` and
`oxfmt.config.ts` TypeScript configs require Node >= 22.18. The published package still supports
Node >= 20.19.

```bash
npm test           # vitest
npm run typecheck  # tsc (including type tests)
npm run lint       # oxlint
npm run format     # oxfmt (write)
npm run build      # tsc (library only)
```

## License

MIT
