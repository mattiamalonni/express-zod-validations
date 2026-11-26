import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  expressZodValidations,
  validate,
  validateBody,
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

    app.post('/test', validateBody(schema), (req: ValidationRequest, res) => {
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

  it('throws only the first failing key when throwErrors is true', async () => {
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
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ValidationError) {
        return res.status(422).json({ name: err.name, key: err.key });
      }
      res.status(500).end();
    });

    const response = await request(app).put('/test/not-a-uuid').send({ name: 123 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ name: 'ValidationError', key: 'params' });
  });
});
