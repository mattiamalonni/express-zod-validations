import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  validate,
  validateBody,
  validateHeaders,
  type ValidationRequest,
} from "../src/index";

describe("validate multiple parts", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("validate() function", () => {
    it("should validate multiple request parts at once", async () => {
      const schema = {
        params: z.object({ id: z.string().length(24) }),
        body: z.object({ title: z.string() }),
        headers: z.object({ "content-type": z.string() }),
      };

      app.put("/posts/:id", validate(schema), (req: ValidationRequest, res) => {
        const { params, body, headers } = req.validationValues || {};
        res.json({
          params,
          body,
          contentType: (headers as any)?.["content-type"],
        });
      });

      const response = await request(app)
        .put("/posts/123456789012345678901234")
        .send({ title: "Test Post" });

      expect(response.status).toBe(200);
      expect(response.body.params).toEqual({ id: "123456789012345678901234" });
      expect(response.body.body).toEqual({ title: "Test Post" });
      expect(response.body.contentType).toContain("application/json");
    });

    it("should collect errors from multiple parts", async () => {
      const schema = {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ email: z.string().email() }),
      };

      app.put("/users/:id", validate(schema), (req: ValidationRequest, res) => {
        const errors = req.validationErrors;
        if (errors && Object.keys(errors).length > 0) {
          return res.status(400).json({ errors });
        }
        res.json({ success: true });
      });

      const response = await request(app)
        .put("/users/invalid-id")
        .send({ email: "invalid-email" });

      expect(response.status).toBe(400);
      expect(response.body.errors.params).toBeDefined();
      expect(response.body.errors.body).toBeDefined();
    });

    it("should handle empty validation schema", async () => {
      app.post("/test", validate({}), (req: ValidationRequest, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post("/test")
        .send({ data: "something" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("chained validators", () => {
    it("should chain multiple validation middlewares", async () => {
      const headerSchema = z.object({
        authorization: z.string(),
      });

      const bodySchema = z.object({
        name: z.string(),
      });

      app.post(
        "/test",
        validateHeaders(headerSchema),
        validateBody(bodySchema),
        (req: ValidationRequest, res) => {
          if (req.validationErrors?.headers || req.validationErrors?.body) {
            return res.status(400).json({ error: "Validation failed" });
          }
          res.json({
            header: req.validationValues?.headers,
            body: req.validationValues?.body,
          });
        },
      );

      const response = await request(app)
        .post("/test")
        .set("Authorization", "Bearer token")
        .send({ name: "John" });

      expect(response.status).toBe(200);
      expect(response.body.body).toEqual({ name: "John" });
      expect(response.body.header).toHaveProperty("authorization");
    });
  });
});
