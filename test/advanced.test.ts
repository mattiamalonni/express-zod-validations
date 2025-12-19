import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody, type ValidationRequest } from "../src/index";

describe("advanced", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("transformations", () => {
    it("should transform data with Zod transformations", async () => {
      const schema = z.object({
        email: z.string().toLowerCase(),
        name: z.string().trim(),
      });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json(req.validationValues?.body);
      });

      const response = await request(app)
        .post("/test")
        .send({ email: "TEST@EXAMPLE.COM", name: "  John  " });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        email: "test@example.com",
        name: "John",
      });
    });

    it("should handle complex transformations", async () => {
      const schema = z.object({
        email: z.string().email().toLowerCase(),
        tags: z.string().transform((val) => val.split(",")),
        active: z
          .string()
          .optional()
          .transform((val) => val === "true"),
      });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json(req.validationValues?.body);
      });

      const response = await request(app).post("/test").send({
        email: "TEST@EXAMPLE.COM",
        tags: "tag1,tag2,tag3",
        active: "true",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        email: "test@example.com",
        tags: ["tag1", "tag2", "tag3"],
        active: true,
      });
    });

    it("should handle optional fields and null transforms", async () => {
      const schema = z.object({
        bio: z
          .string()
          .trim()
          .optional()
          .transform((val) => (val === "" ? null : val)),
      });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json(req.validationValues?.body);
      });

      const response = await request(app).post("/test").send({ bio: "   " });

      expect(response.status).toBe(200);
      expect(response.body.bio).toBeNull();
    });
  });

  describe("schema modifiers", () => {
    it("should passthrough unknown fields", async () => {
      const schema = z.object({ name: z.string() }).loose();

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json(req.validationValues?.body);
      });

      const response = await request(app)
        .post("/test")
        .send({ name: "John", extra: "field" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name: "John", extra: "field" });
    });

    it("should reject unknown fields in strict mode", async () => {
      const schema = z.object({ name: z.string() }).strict();

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        if (req.validationErrors?.body) {
          return res.status(400).json({ error: "Strict validation failed" });
        }
        res.json(req.validationValues?.body);
      });

      const response = await request(app)
        .post("/test")
        .send({ name: "John", extra: "field" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Strict validation failed");
    });

    it("should strip unknown fields by default", async () => {
      const schema = z.object({ name: z.string() });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json(req.validationValues?.body);
      });

      const response = await request(app)
        .post("/test")
        .send({ name: "John", extra: "field" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ name: "John" });
      expect(response.body.extra).toBeUndefined();
    });
  });

  describe("validation options", () => {
    it("should pass validation options to Zod", async () => {
      const schema = z.object({ name: z.string() });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        if (req.validationErrors?.body) {
          return res.status(400).json({
            hasError: true,
            issueCount: req.validationErrors.body.issues.length,
          });
        }
        res.json({ success: true });
      });

      const response = await request(app).post("/test").send({});

      expect(response.status).toBe(400);
      expect(response.body.hasError).toBe(true);
      expect(response.body.issueCount).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should continue to next middleware on success", async () => {
      const schema = z.object({ name: z.string() });

      let middlewareCalled = false;

      app.post(
        "/test",
        validateBody(schema),
        (req, res, next) => {
          middlewareCalled = true;
          next();
        },
        (req, res) => {
          res.json({ middlewareCalled });
        },
      );

      const response = await request(app).post("/test").send({ name: "John" });

      expect(response.status).toBe(200);
      expect(response.body.middlewareCalled).toBe(true);
    });

    it("should preserve original request data when overwriteRequest is false", async () => {
      const schema = z.object({
        text: z.string().trim(),
      });

      app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
        res.json({
          original: req.body,
          validated: req.validationValues?.body,
        });
      });

      const response = await request(app)
        .post("/test")
        .send({ text: "  spaces  " });

      expect(response.status).toBe(200);
      expect(response.body.original.text).toBe("  spaces  ");
      expect(response.body.validated.text).toBe("spaces");
    });
  });
});
