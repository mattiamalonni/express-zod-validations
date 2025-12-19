import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { validateQuery, type ValidationRequest } from "../src/index";

describe("validateQuery", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("should validate and coerce query parameters", async () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1),
      limit: z.coerce.number().int().min(1).max(100),
      sort: z.enum(["asc", "desc"]).optional(),
    });

    app.get("/items", validateQuery(schema), (req: ValidationRequest, res) => {
      res.json(req.validationValues.query);
    });

    const response = await request(app).get("/items?page=2&limit=20&sort=asc");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ page: 2, limit: 20, sort: "asc" });
    expect(typeof response.body.page).toBe("number");
  });

  it("should apply default values", async () => {
    const schema = z.object({
      page: z.coerce.number().int().default(1),
      sort: z.enum(["asc", "desc"]).default("asc"),
    });

    app.get("/items", validateQuery(schema), (req: ValidationRequest, res) => {
      res.json(req.validationValues.query);
    });

    const response = await request(app).get("/items");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ page: 1, sort: "asc" });
  });
});
