import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  validateBody,
  validateBodyAsync,
  validateHeaders,
  validateHeadersAsync,
  validateParamsAsync,
  validateQueryAsync,
  ValidationError,
  type ValidationRequest,
} from '../src/index';

describe('validator modes and edge cases', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('validates with validateAsync using a synchronous schema', async () => {
    app.post(
      '/test',
      validateBodyAsync(z.object({ name: z.string() })),
      (req: ValidationRequest, res) => {
        res.json({ values: req.validationValues?.body });
      },
    );

    const response = await request(app).post('/test').send({ name: 'John' });

    expect(response.status).toBe(200);
    expect(response.body.values).toEqual({ name: 'John' });
  });

  it('supports the async variants for params, query and headers', async () => {
    app.get(
      '/test/:id',
      validateParamsAsync(z.object({ id: z.string() })),
      validateQueryAsync(z.object({ page: z.coerce.number() })),
      validateHeadersAsync(z.object({ 'x-token': z.string() })),
      (req: ValidationRequest, res) => {
        res.json({ values: req.validationValues });
      },
    );

    const response = await request(app).get('/test/42?page=3').set('x-token', 'abc');

    expect(response.status).toBe(200);
    expect(response.body.values.params).toEqual({ id: '42' });
    expect(response.body.values.query).toEqual({ page: 3 });
    expect(response.body.values.headers).toEqual({ 'x-token': 'abc' });
  });

  it('forwards a clear error when an async schema is used with the sync validator', async () => {
    const schema = z.object({ name: z.string().refine(async () => true) });
    let message = '';

    app.post('/test', validateBody(schema), (_req, res) => {
      res.json({ success: true });
    });
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      message = err instanceof Error ? err.message : String(err);
      res.status(500).end();
    });

    const response = await request(app).post('/test').send({ name: 'John' });

    expect(response.status).toBe(500);
    expect(message).toContain('synchronous parse');
  });

  it('honours a per-request config set by an earlier middleware', async () => {
    app.use((req, _res, next) => {
      (req as ValidationRequest).validationConfigs = { throwErrors: true };
      next();
    });
    app.post('/test', validateBody(z.object({ name: z.string() })), (_req, res) => {
      res.json({ success: true });
    });
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ValidationError) {
        return res.status(422).json({ key: err.key });
      }
      res.status(500).end();
    });

    const response = await request(app).post('/test').send({ name: 123 });

    expect(response.status).toBe(422);
    expect(response.body.key).toBe('body');
  });

  it('matches headers case-insensitively', async () => {
    app.get(
      '/test',
      validateHeaders(z.object({ 'x-token': z.string() })),
      (req: ValidationRequest, res) => {
        res.json({ values: req.validationValues?.headers });
      },
    );

    const response = await request(app).get('/test').set('X-Token', 'abc');

    expect(response.status).toBe(200);
    expect(response.body.values).toEqual({ 'x-token': 'abc' });
  });

  it('validates an undefined body with an optional schema', async () => {
    app.post(
      '/test',
      validateBody(z.object({ name: z.string() }).optional()),
      (req: ValidationRequest, res) => {
        res.json({
          hasError: Boolean(req.validationErrors?.body),
          value: req.validationValues?.body ?? null,
        });
      },
    );

    const response = await request(app).post('/test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasError: false, value: null });
  });

  it('keeps the last result when validators are chained on the same key', async () => {
    app.post(
      '/test',
      validateBody(z.object({ name: z.string() })),
      validateBody(z.object({ age: z.number() })),
      (req: ValidationRequest, res) => {
        res.json({
          hasError: Boolean(req.validationErrors?.body),
          value: req.validationValues?.body ?? null,
        });
      },
    );

    const response = await request(app).post('/test').send({ name: 'John' });

    expect(response.status).toBe(200);
    expect(response.body.hasError).toBe(true);
    expect(response.body.value).toBeNull();
  });
});
