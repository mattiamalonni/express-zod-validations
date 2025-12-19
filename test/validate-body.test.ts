import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody, type ValidationRequest } from "../src/index";

describe("validateBody", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("should validate valid body data", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
      res.json(req.validationValues?.body);
    });

    const response = await request(app)
      .post("/test")
      .send({ name: "John", age: 30 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "John", age: 30 });
  });

  it("should store validation errors when throwErrors is false", async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    app.post("/test", validateBody(schema), (req: ValidationRequest, res) => {
      if (req.validationErrors?.body) {
        return res
          .status(400)
          .json({ errors: req.validationErrors.body.issues });
      }
      res.json({ success: true });
    });

    const response = await request(app)
      .post("/test")
      .send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].path).toContain("email");
  });
});
