import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  expressZodValidations,
  validate,
  validateAsync,
  validateBody,
  validateBodyAsync,
  ValidationError,
  type ValidationRequest,
} from '../src/index';

describe('validation options and error paths', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('passes Zod v4 parse options through to the schema', async () => {
    app.post(
      '/test',
      validateBody(z.object({ name: z.string() }), {
        error: () => 'CUSTOM_ERROR',
      }),
      (req: ValidationRequest, res) => {
        if (req.validationErrors?.body) {
          return res.status(400).json({
            messages: req.validationErrors.body.issues.map((issue) => issue.message),
          });
        }
        res.json({ success: true });
      },
    );

    const response = await request(app).post('/test').send({});

    expect(response.status).toBe(400);
    expect(response.body.messages).toContain('CUSTOM_ERROR');
  });

  it('stores errors from async refinements', async () => {
    const schema = z.object({
      token: z.string().refine(async (value) => value === 'ok', 'invalid token'),
    });

    app.post('/test', validateBodyAsync(schema), (req: ValidationRequest, res) => {
      if (req.validationErrors?.body) {
        return res.status(400).json({
          messages: req.validationErrors.body.issues.map((issue) => issue.message),
          values: req.validationValues?.body ?? null,
        });
      }
      res.json({ success: true });
    });

    const response = await request(app).post('/test').send({ token: 'wrong' });

    expect(response.status).toBe(400);
    expect(response.body.messages).toContain('invalid token');
    expect(response.body.values).toBeNull();
  });

  it('throws the first failing key without applying partial results', async () => {
    app.use(expressZodValidations({ throwErrors: true }));
    app.put(
      '/test/:id',
      validate({
        params: z.object({ id: z.uuid() }),
        body: z.object({ name: z.string() }),
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    let state: { values?: unknown; errors?: unknown } | undefined;
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ValidationError) {
        const validationRequest = req as ValidationRequest;
        state = {
          values: validationRequest.validationValues,
          errors: validationRequest.validationErrors,
        };
        return res.status(422).json({ name: err.name, key: err.key });
      }
      res.status(500).end();
    });

    const response = await request(app).put('/test/not-a-uuid').send({ name: 123 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ name: 'ValidationError', key: 'params' });
    // Nothing is written to the request when an error is thrown.
    expect(state).toEqual({ values: undefined, errors: undefined });
  });

  it('keeps the request untouched with validateAsync when throwErrors is true', async () => {
    app.use(expressZodValidations({ throwErrors: true, overwriteRequest: true }));
    let originalParams: unknown;
    app.put(
      '/test/:id',
      (req, _res, next) => {
        originalParams = req.params;
        next();
      },
      validateAsync({
        params: z.object({ id: z.uuid() }),
        query: z.object({ page: z.coerce.number().default(1) }),
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    let state: { values?: unknown; errors?: unknown; query?: unknown } | undefined;
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ValidationError) {
        const validationRequest = req as ValidationRequest;
        state = {
          values: validationRequest.validationValues,
          errors: validationRequest.validationErrors,
          query: req.query,
        };
        return res.status(422).json({ key: err.key });
      }
      res.status(500).end();
    });

    const response = await request(app).put('/test/not-a-uuid?page=3');

    expect(response.status).toBe(422);
    expect(response.body.key).toBe('params');
    expect(state).toEqual({
      values: undefined,
      errors: undefined,
      query: { page: '3' },
    });
    expect(originalParams).toEqual({ id: 'not-a-uuid' });
  });

  it('does not overwrite req.body when another part fails', async () => {
    app.use(expressZodValidations({ throwErrors: true, overwriteRequest: true }));
    app.put(
      '/test/:id',
      validate({
        params: z.object({ id: z.uuid() }),
        body: z.object({ name: z.string().transform((value) => value.toUpperCase()) }),
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    let body: unknown;
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ValidationError) {
        body = req.body;
        return res.status(422).end();
      }
      res.status(500).end();
    });

    const response = await request(app).put('/test/not-a-uuid').send({ name: 'john' });

    expect(response.status).toBe(422);
    expect(body).toEqual({ name: 'john' });
  });
});
