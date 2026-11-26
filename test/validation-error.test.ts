import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import {
  ValidationError,
  expressZodValidations,
  validateBody,
  validateParams,
  validateQuery,
} from '../src/index';

describe('ValidationError', () => {
  describe('class shape', () => {
    it('should be an instance of ZodError', () => {
      const zodError = new ZodError([{ code: 'custom', message: 'bad', path: ['field'] }]);
      const err = new ValidationError('body', zodError);
      expect(err).toBeInstanceOf(ZodError);
    });

    it('should be an instance of ValidationError', () => {
      const zodError = new ZodError([{ code: 'custom', message: 'bad', path: ['field'] }]);
      const err = new ValidationError('body', zodError);
      expect(err).toBeInstanceOf(ValidationError);
    });

    it('should have name set to ValidationError', () => {
      const zodError = new ZodError([{ code: 'custom', message: 'bad', path: ['field'] }]);
      const err = new ValidationError('body', zodError);
      expect(err.name).toBe('ValidationError');
    });

    it('should carry the key that failed', () => {
      const zodError = new ZodError([{ code: 'custom', message: 'bad', path: ['field'] }]);
      const err = new ValidationError('query', zodError);
      expect(err.key).toBe('query');
    });

    it('should preserve the ZodError issues', () => {
      const issues: ZodError['issues'] = [{ code: 'custom', message: 'too short', path: ['name'] }];
      const zodError = new ZodError(issues);
      const err = new ValidationError('body', zodError);
      expect(err.issues).toEqual(issues);
    });
  });

  describe('throwErrors integration', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(expressZodValidations({ throwErrors: true }));
    });

    it('should throw a ValidationError when body validation fails', async () => {
      const schema = z.object({ name: z.string() });

      app.post('/test', validateBody(schema), (_req, res) => {
        res.json({ success: true });
      });

      app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).key).toBe('body');
        res.status(422).end();
      });

      await request(app).post('/test').send({ name: 123 });
    });

    it('should throw a ValidationError when query validation fails', async () => {
      const schema = z.object({ page: z.coerce.number().int().positive() });

      app.get('/test', validateQuery(schema), (_req, res) => {
        res.json({ success: true });
      });

      app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).key).toBe('query');
        res.status(422).end();
      });

      await request(app).get('/test').query({ page: 'abc' });
    });

    it('should throw a ValidationError when params validation fails', async () => {
      const schema = z.object({ id: z.coerce.number().int().positive() });

      app.get('/test/:id', validateParams(schema), (_req, res) => {
        res.json({ success: true });
      });

      app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).key).toBe('params');
        res.status(422).end();
      });

      await request(app).get('/test/not-a-number');
    });

    it('should include ZodError issues in the thrown ValidationError', async () => {
      const schema = z.object({ email: z.email() });

      app.post('/test', validateBody(schema), (_req, res) => {
        res.json({ success: true });
      });

      app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).issues.length).toBeGreaterThan(0);
        expect((err as ValidationError).issues[0].path).toContain('email');
        res.status(422).end();
      });

      await request(app).post('/test').send({ email: 'not-an-email' });
    });

    it('should not throw when validation passes', async () => {
      const schema = z.object({ email: z.email() });

      app.post('/test', validateBody(schema), (_req, res) => {
        res.json({ success: true });
      });

      app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        res.status(500).end();
      });

      const response = await request(app).post('/test').send({ email: 'valid@example.com' });

      expect(response.status).toBe(200);
    });
  });
});
