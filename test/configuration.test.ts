import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  expressZodValidations,
  validateBody,
  type ValidationRequest,
} from "../src/index";

describe("configuration", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("throwErrors option", () => {
    it("should throw validation errors when throwErrors is true", async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      app.use(expressZodValidations({ throwErrors: true }));
      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json({ success: true });
      });

      app.use((err: any, req: any, res: any, next: any) => {
        if (err.name === "ZodError") {
          return res.status(422).json({ zodError: true, issues: err.errors });
        }
        next(err);
      });

      const response = await request(app)
        .post("/test")
        .send({ email: "invalid" });

      expect(response.status).toBe(422);
      expect(response.body.zodError).toBe(true);
    });

    it("should apply global throwErrors config", async () => {
      const schema = z.object({ email: z.string().email() });

      app.use(expressZodValidations({ throwErrors: true }));
      app.post("/test", validateBody(schema), (req, res) => {
        res.json({ success: true });
      });

      app.use((err: any, req: any, res: any, next: any) => {
        if (err.name === "ZodError") {
          return res.status(400).json({ caught: true });
        }
        next(err);
      });

      const response = await request(app)
        .post("/test")
        .send({ email: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body.caught).toBe(true);
    });
  });

  describe("overwriteRequest option", () => {
    it("should overwrite request body when overwriteRequest is true", async () => {
      const schema = z.object({
        email: z.string().toLowerCase(),
      });

      app.use(expressZodValidations({ overwriteRequest: true }));
      app.post("/test", validateBody(schema), (req, res) => {
        res.json({ body: req.body });
      });

      const response = await request(app)
        .post("/test")
        .send({ email: "TEST@EXAMPLE.COM" });

      expect(response.status).toBe(200);
      expect(response.body.body).toEqual({ email: "test@example.com" });
    });

    it("should apply global overwriteRequest config", async () => {
      const schema = z.object({
        text: z.string().trim(),
      });

      app.use(expressZodValidations({ overwriteRequest: true }));
      app.post("/test", validateBody(schema), (req, res) => {
        res.json({ original: req.body });
      });

      const response = await request(app)
        .post("/test")
        .send({ text: "  trimmed  " });

      expect(response.status).toBe(200);
      expect(response.body.original).toEqual({ text: "trimmed" });
    });
  });
});
