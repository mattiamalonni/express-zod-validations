import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { validateHeaders, type ValidationRequest } from "../src/index";

describe("validateHeaders", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("should validate request headers", async () => {
    const schema = z.object({
      authorization: z.string().startsWith("Bearer "),
    });

    app.get(
      "/protected",
      validateHeaders(schema),
      (req: ValidationRequest, res) => {
        res.json({ authenticated: true });
      },
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer token123");

    expect(response.status).toBe(200);
    expect(response.body.authenticated).toBe(true);
  });

  it("should fail on missing headers", async () => {
    const schema = z.object({
      authorization: z.string(),
    });

    app.get(
      "/protected",
      validateHeaders(schema),
      (req: ValidationRequest, res) => {
        if (req.validationErrors?.headers) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        res.json({ success: true });
      },
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Unauthorized");
  });
});
