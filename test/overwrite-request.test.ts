import express, { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  expressZodValidations,
  validate,
  validateHeaders,
  validateParams,
  validateQuery,
  type ValidationRequest,
} from '../src/index';

describe('overwriteRequest', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(expressZodValidations({ overwriteRequest: true }));
  });

  it('overwrites req.query with the parsed and transformed values', async () => {
    app.get(
      '/test',
      validateQuery(z.object({ page: z.coerce.number().default(1) })),
      (req: ValidationRequest, res) => {
        res.json({ query: req.query, values: req.validationValues?.query });
      },
    );

    const response = await request(app).get('/test?page=3');

    expect(response.status).toBe(200);
    expect(response.body.query).toEqual({ page: 3 });
    expect(response.body.values).toEqual({ page: 3 });
  });

  it('overwrites req.params and req.headers', async () => {
    app.get(
      '/test/:id',
      validateParams(z.object({ id: z.string().transform((value) => value.toUpperCase()) })),
      validateHeaders(z.object({ 'x-token': z.string().toLowerCase() })),
      (req: ValidationRequest, res) => {
        res.json({
          params: req.params,
          token: req.headers['x-token'],
          values: req.validationValues,
        });
      },
    );

    const response = await request(app).get('/test/abc').set('x-token', 'ABC123');

    expect(response.status).toBe(200);
    expect(response.body.params).toEqual({ id: 'ABC' });
    expect(response.body.token).toBe('abc123');
    expect(response.body.values.params).toEqual({ id: 'ABC' });
    expect(response.body.values.headers).toEqual({ 'x-token': 'abc123' });
  });

  it('overwrites req.query when validate() is used for multiple parts', async () => {
    app.get(
      '/test/:id',
      validate({
        query: z.object({ page: z.coerce.number() }),
        params: z.object({ id: z.string() }),
      }),
      (req: ValidationRequest, res) => {
        res.json({ query: req.query, params: req.params });
      },
    );

    const response = await request(app).get('/test/42?page=7');

    expect(response.status).toBe(200);
    expect(response.body.query).toEqual({ page: 7 });
    expect(response.body.params).toEqual({ id: '42' });
  });
});
