import { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export interface ValidationConfigs {
  throwErrors?: boolean;
  overwriteRequest?: boolean;
}

type ValidationKey = "headers" | "params" | "query" | "body";

export interface ValidationErrors extends Partial<
  Record<ValidationKey, ZodError>
> {}
export interface ValidationValues extends Partial<
  Record<ValidationKey, unknown>
> {}

export interface ValidationRequest extends Request {
  validationConfigs?: ValidationConfigs;
  validationErrors?: ValidationErrors;
  validationValues?: ValidationValues;
}

export type ValidationProps = Partial<Record<ValidationKey, ZodType>>;
export type ValidationOptions = Parameters<ZodType["parse"]>[1];

export const expressZodValidations =
  (configs: ValidationConfigs) =>
  (req: ValidationRequest, _: Response, next: NextFunction) => {
    req.validationConfigs = configs;
    next();
  };

export const validate =
  (props: ValidationProps, options?: ValidationOptions) =>
  async (req: ValidationRequest, _: Response, next: NextFunction) => {
    try {
      req.validationConfigs ??= {};
      req.validationErrors ??= {};
      req.validationValues ??= {};

      const { throwErrors = false, overwriteRequest = false } =
        req.validationConfigs;

      for (const [key, schema] of Object.entries(props) as [
        ValidationKey,
        ZodType,
      ][]) {
        if (!schema) continue;

        const result = await schema.safeParseAsync(req[key], options);

        if (result.success) {
          delete req.validationErrors[key];
          req.validationValues[key] = result.data;
          if (overwriteRequest) req[key] = result.data as never;
        } else {
          req.validationErrors[key] = result.error;
          delete req.validationValues[key];
          if (throwErrors) return next(result.error);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export const validateHeaders = (
  headers: ZodType,
  options?: ValidationOptions,
) => validate({ headers }, options);
export const validateParams = (params: ZodType, options?: ValidationOptions) =>
  validate({ params }, options);
export const validateQuery = (query: ZodType, options?: ValidationOptions) =>
  validate({ query }, options);
export const validateBody = (body: ZodType, options?: ValidationOptions) =>
  validate({ body }, options);

export default validate;
