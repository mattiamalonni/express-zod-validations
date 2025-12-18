# express-zod-validations

Type-safe Express middleware for validating requests using [Zod](https://github.com/colinhacks/zod).

## Features

- 🛡️ **Type-safe validation** - Full TypeScript support with Zod schemas
- 🚀 **Async by default** - Uses `safeParseAsync` for async transformations
- 🎯 **Granular validation** - Validate body, params, query, and headers independently
- 🔧 **Flexible error handling** - Choose between storing or throwing validation errors
- 📦 **Zero config** - Works out of the box with sensible defaults

## Installation

```bash
npm install express-zod-validations zod express
```

## Quick Start

```typescript
import express from "express";
import { z } from "zod";
import { validateBody } from "express-zod-validations";

const app = express();
app.use(express.json());

// Define your schema
const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// Use it in your route
app.post("/users", validateBody(userSchema), (req, res) => {
  // Access validated data
  const user = req.validationValues.body;

  // Check for errors (if throwErrors is false)
  if (req.validationErrors?.body) {
    return res.status(400).json({ errors: req.validationErrors.body.errors });
  }

  res.json({ message: "User created", user });
});

app.listen(3000);
```

## Usage

### Validate Different Request Parts

```typescript
import { z } from "zod";
import {
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
} from "express-zod-validations";

// Body validation
app.post("/users", validateBody(z.object({ name: z.string() })), handler);

// URL params validation
app.get(
  "/users/:id",
  validateParams(z.object({ id: z.string().uuid() })),
  handler,
);

// Query string validation
app.get(
  "/users",
  validateQuery(z.object({ page: z.coerce.number().int().min(1).default(1) })),
  handler,
);

// Headers validation
app.get(
  "/protected",
  validateHeaders(
    z.object({ authorization: z.string().startsWith("Bearer ") }),
  ),
  handler,
);
```

### Validate Multiple Parts at Once

```typescript
import { z } from "zod";
import validate from "express-zod-validations";

app.put(
  "/posts/:id",
  validate({
    params: z.object({ id: z.string().length(24) }),
    body: z.object({ title: z.string(), content: z.string().min(10) }),
    headers: z.object({ authorization: z.string() }),
  }),
  (req, res) => {
    // All validated values are available
    const { params, body, headers } = req.validationValues;
    res.json({ params, body });
  },
);
```

### Chain Multiple Validators

```typescript
app.put(
  "/posts/:id",
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
import express from "express";
import { expressZodValidations } from "express-zod-validations";

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

- **`overwriteRequest`** (default: `false`)
  When `true`, replaces `req.body`, `req.params`, etc. with the parsed and transformed values from Zod.
  When `false`, parsed values are stored in `req.validationValues`.

### Per-Route Validation Options

Pass Zod parsing options as a second parameter:

```typescript
validateBody(userSchema, {
  errorMap: (issue, ctx) => ({
    message: `Custom error: ${issue.path.join(".")}`,
  }),
});
```

## Accessing Validation Results

### Validated Values

```typescript
app.post("/users", validateBody(userSchema), (req, res) => {
  // Original request body (untransformed)
  console.log(req.body);

  // Validated and transformed data
  console.log(req.validationValues.body);
});
```

### Validation Errors

When `throwErrors` is `false`, errors are accessible via `req.validationErrors`:

```typescript
app.post("/users", validateBody(userSchema), (req, res) => {
  if (req.validationErrors?.body) {
    return res.status(400).json({
      error: "Validation failed",
      issues: req.validationErrors.body.errors,
    });
  }

  // Process valid data
  res.json(req.validationValues.body);
});
```

## TypeScript Support

The middleware extends the Express `Request` type:

```typescript
import { ValidationRequest } from "express-zod-validations";

app.post("/users", validateBody(userSchema), (req: ValidationRequest, res) => {
  // TypeScript knows about validationValues and validationErrors
  req.validationValues.body;
  req.validationErrors?.body;
});
```

## Error Handling

### Option 1: Store Errors (Default)

```typescript
app.post("/users", validateBody(userSchema), (req, res) => {
  if (req.validationErrors?.body) {
    return res.status(400).json({ errors: req.validationErrors.body.errors });
  }
  // Handle valid request
});
```

### Option 2: Throw Errors

```typescript
// Enable globally
app.use(expressZodValidations({ throwErrors: true }));

// Add error handler
app.use((err, req, res, next) => {
  if (err.name === "ZodError") {
    return res.status(400).json({ errors: err.errors });
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
  sort: z.enum(["asc", "desc"]).default("asc"),
});

app.get("/posts", validateQuery(paginationSchema), (req, res) => {
  const { page, limit, sort } = req.validationValues.query;
  // page and limit are numbers, not strings
});
```

### Transform and Sanitize Data

```typescript
const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(2),
  bio: z
    .string()
    .trim()
    .optional()
    .transform((val) => val || null),
});

app.post("/users", validateBody(createUserSchema), (req, res) => {
  // Email is lowercased, name is trimmed, empty bio becomes null
  const user = req.validationValues.body;
});
```

### Allow Unknown Fields

By default, Zod strips unknown properties. To change this:

```typescript
// Allow extra fields
const schema = z.object({ name: z.string() }).passthrough();

// Strict mode - error on extra fields
const strictSchema = z.object({ name: z.string() }).strict();
```

## API Reference

### Functions

- `validate(props, options?)` - Validate multiple request parts
- `validateBody(schema, options?)` - Validate request body
- `validateParams(schema, options?)` - Validate URL parameters
- `validateQuery(schema, options?)` - Validate query string
- `validateHeaders(schema, options?)` - Validate headers
- `expressZodValidations(config)` - Set global configuration

### Types

- `ValidationRequest` - Extended Express Request with validation fields
- `ValidationConfigs` - Configuration options type
- `ValidationErrors` - Validation errors object type
- `ValidationValues` - Validated values object type

## License

MIT
