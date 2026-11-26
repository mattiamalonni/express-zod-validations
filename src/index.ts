import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType, type output } from 'zod';

export class ValidationError extends ZodError {
  public readonly key: string;

  constructor(key: string, cause: ZodError) {
    super(cause.issues);
    this.name = 'ValidationError';
    this.key = key;
  }
}

export interface ValidationConfigs {
  throwErrors?: boolean;
  overwriteRequest?: boolean;
}

type ValidationKey = 'headers' | 'params' | 'query' | 'body';

export type ValidationProps = Partial<Record<ValidationKey, ZodType>>;
export type ValidationErrors = Partial<Record<ValidationKey, ZodError>>;

/** Validated values, inferred from the schemas passed to `validate`. */
export type ValidationValues<S extends ValidationProps = ValidationProps> = {
  [K in keyof S]?: NonNullable<S[K]> extends ZodType ? output<NonNullable<S[K]>> : unknown;
};

export interface ValidationRequest<S extends ValidationProps = ValidationProps> extends Request {
  validationConfigs?: ValidationConfigs;
  validationErrors?: ValidationErrors;
  validationValues?: ValidationValues<S>;
}

export type ValidationOptions = Parameters<ZodType['safeParseAsync']>[1];

export const expressZodValidations =
  (configs: ValidationConfigs) => (req: ValidationRequest, _: Response, next: NextFunction) => {
    req.validationConfigs = configs;
    next();
  };

export const validate =
  <S extends ValidationProps>(props: S, options?: ValidationOptions) =>
  async (req: ValidationRequest<S>, _: Response, next: NextFunction) => {
    let forwarded = false;
    const done = () => {
      if (forwarded) return;
      forwarded = true;
      next();
    };
    const fail = (error: unknown) => {
      if (forwarded) return;
      forwarded = true;
      next(error);
    };

    try {
      req.validationConfigs ??= {};
      const errors = (req.validationErrors ??= {}) as ValidationErrors;
      const values = (req.validationValues ??= {}) as ValidationValues;

      const { throwErrors = false, overwriteRequest = false } = req.validationConfigs;

      for (const [key, schema] of Object.entries(props) as [ValidationKey, ZodType][]) {
        if (!schema) continue;

        const result = await schema.safeParseAsync(req[key], options);

        if (result.success) {
          delete errors[key];
          values[key] = result.data;
          if (overwriteRequest) {
            if (key === 'query') {
              // Express defines `req.query` as a getter without a setter.
              // An own property shadows it; a plain assignment would throw.
              Object.defineProperty(req, 'query', {
                value: result.data,
                writable: true,
                enumerable: true,
                configurable: true,
              });
            } else {
              req[key] = result.data as never;
            }
          }
        } else {
          errors[key] = result.error;
          delete values[key];
          if (throwErrors) return fail(new ValidationError(key, result.error));
        }
      }

      done();
    } catch (error) {
      fail(error);
    }
  };

export const validateHeaders = <S extends ZodType>(headers: S, options?: ValidationOptions) =>
  validate({ headers }, options);
export const validateParams = <S extends ZodType>(params: S, options?: ValidationOptions) =>
  validate({ params }, options);
export const validateQuery = <S extends ZodType>(query: S, options?: ValidationOptions) =>
  validate({ query }, options);
export const validateBody = <S extends ZodType>(body: S, options?: ValidationOptions) =>
  validate({ body }, options);

export default validate;
