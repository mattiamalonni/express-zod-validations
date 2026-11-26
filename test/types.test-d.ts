import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import {
  validate,
  validateAsync,
  validateBody,
  validateBodyAsync,
  type ValidationRequest,
  type ValidationValues,
} from '../src/index';

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

// `ValidationRequest<S>` infers the output of each schema.
declare const request: ValidationRequest<{ body: typeof schema }>;
const name: string | undefined = request.validationValues?.body?.name;
const age: number | undefined = request.validationValues?.body?.age;
// @ts-expect-error `name` is a string, not a number
const wrong: number | undefined = request.validationValues?.body?.name;

// Without a type argument the values stay `unknown` (backwards compatible).
declare const plainRequest: ValidationRequest;
const unknownValue: unknown = plainRequest.validationValues?.body;

const values: ValidationValues<{ body: typeof schema }> = { body: { name: 'John' } };

// Both the sync and async middleware infer the request type from their schemas.
const syncMiddleware = validateBody(schema);
const asyncMiddleware = validateBodyAsync(schema);
type SyncRequest = Parameters<typeof syncMiddleware>[0];
type AsyncRequest = Parameters<typeof asyncMiddleware>[0];
declare const syncRequest: SyncRequest;
declare const asyncRequest: AsyncRequest;
const syncName: string | undefined = syncRequest.validationValues?.body?.name;
const asyncName: string | undefined = asyncRequest.validationValues?.body?.name;

// Multiple keys work the same way.
const multiMiddleware = validate({ body: schema, query: z.object({ page: z.coerce.number() }) });
type MultiRequest = Parameters<typeof multiMiddleware>[0];
declare const multiRequest: MultiRequest;
const page: number | undefined = multiRequest.validationValues?.query?.page;

const multiAsyncMiddleware = validateAsync({ body: schema });
type MultiAsyncRequest = Parameters<typeof multiAsyncMiddleware>[0];
declare const multiAsyncRequest: MultiAsyncRequest;
const multiAsyncName: string | undefined = multiAsyncRequest.validationValues?.body?.name;

// Express accepts both middleware shapes.
declare const next: NextFunction;
declare const response: Response;
syncMiddleware(request, response, next);
void asyncMiddleware(request, response, next);

void name;
void age;
void wrong;
void unknownValue;
void values;
void syncName;
void asyncName;
void page;
void multiAsyncName;
