import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { validateParams, type ValidationRequest } from "../src/index";

describe("validateParams", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("should validate URL parameters", async () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    app.get(
      "/users/:id",
      validateParams(schema),
      (req: ValidationRequest, res) => {
        res.json(req.validationValues.params);
      },
    );

    const validId = "123e4567-e89b-12d3-a456-426614174000";
    const response = await request(app).get(`/users/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: validId });
  });

  it("should fail on invalid params", async () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    app.get(
      "/users/:id",
      validateParams(schema),
      (req: ValidationRequest, res) => {
        if (req.validationErrors?.params) {
          return res.status(400).json({ error: "Invalid params" });
        }
        res.json({ success: true });
      },
    );

    const response = await request(app).get("/users/invalid-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid params");
  });
});
