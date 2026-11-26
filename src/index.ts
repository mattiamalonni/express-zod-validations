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

type Parsed = { success: true; data: unknown } | { success: false; error: ZodError };

const entriesOf = (props: ValidationProps) => Object.entries(props) as [ValidationKey, ZodType][];

const overwriteValue = (req: ValidationRequest, key: ValidationKey, value: unknown) => {
  switch (key) {
    case 'query':
      // Express defines `req.query` as a getter without a setter.
      // An own property shadows it; a plain assignment would throw.
      Object.defineProperty(req, 'query', {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      break;
    case 'headers':
      // Merge instead of replacing: Zod strips unknown keys by default, which
      // would drop Express headers such as `host` and `content-type`.
      Object.assign(req.headers, value as Record<string, unknown>);
      break;
    default:
      req[key] = value as never;
  }
};

const applyResults = (
  req: ValidationRequest,
  results: readonly [ValidationKey, Parsed][],
  configs: ValidationConfigs,
) => {
  const firstFailure = results.find(([, result]) => !result.success);
  if (firstFailure && configs.throwErrors) {
    // Atomic failure: leave request state untouched.
    throw new ValidationError(
      firstFailure[0],
      (firstFailure[1] as Extract<Parsed, { success: false }>).error,
    );
  }

  const errors = (req.validationErrors ??= {}) as ValidationErrors;
  const values = (req.validationValues ??= {}) as ValidationValues;

  for (const [key, result] of results) {
    if (result.success) {
      delete errors[key];
      values[key] = result.data;
      if (configs.overwriteRequest) overwriteValue(req, key, result.data);
    } else {
      errors[key] = result.error;
      delete values[key];
    }
  }
};

const createGuard = (next: NextFunction) => {
  let forwarded = false;
  return {
    done: () => {
      if (forwarded) return;
      forwarded = true;
      next();
    },
    fail: (error: unknown) => {
      if (forwarded) return;
      forwarded = true;
      next(error);
    },
  };
};

const collectSync = (
  req: ValidationRequest,
  props: ValidationProps,
  options?: ValidationOptions,
): [ValidationKey, Parsed][] => {
  const results: [ValidationKey, Parsed][] = [];
  for (const [key, schema] of entriesOf(props)) {
    if (!schema) continue;
    const result = schema.safeParse(req[key], options);
    results.push([
      key,
      result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error },
    ]);
  }
  return results;
};

const collectAsync = async (
  req: ValidationRequest,
  props: ValidationProps,
  options?: ValidationOptions,
): Promise<[ValidationKey, Parsed][]> => {
  const results: [ValidationKey, Parsed][] = [];
  for (const [key, schema] of entriesOf(props)) {
    if (!schema) continue;
    const result = await schema.safeParseAsync(req[key], options);
    results.push([
      key,
      result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error },
    ]);
  }
  return results;
};

export const expressZodValidations =
  (configs: ValidationConfigs) => (req: ValidationRequest, _: Response, next: NextFunction) => {
    req.validationConfigs = configs;
    next();
  };

/** Synchronous validation (Zod `safeParse`). Use `validateAsync` for async schemas. */
export const validate =
  <S extends ValidationProps>(props: S, options?: ValidationOptions) =>
  (req: ValidationRequest<S>, _: Response, next: NextFunction): void => {
    const { done, fail } = createGuard(next);
    try {
      const configs = (req.validationConfigs ??= {});
      applyResults(req, collectSync(req, props, options), configs);
      done();
    } catch (error) {
      fail(error);
    }
  };

/** Asynchronous validation (Zod `safeParseAsync`). Required for async refinements/transforms. */
export const validateAsync =
  <S extends ValidationProps>(props: S, options?: ValidationOptions) =>
  async (req: ValidationRequest<S>, _: Response, next: NextFunction): Promise<void> => {
    const { done, fail } = createGuard(next);
    try {
      const configs = (req.validationConfigs ??= {});
      applyResults(req, await collectAsync(req, props, options), configs);
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

export const validateHeadersAsync = <S extends ZodType>(headers: S, options?: ValidationOptions) =>
  validateAsync({ headers }, options);
export const validateParamsAsync = <S extends ZodType>(params: S, options?: ValidationOptions) =>
  validateAsync({ params }, options);
export const validateQueryAsync = <S extends ZodType>(query: S, options?: ValidationOptions) =>
  validateAsync({ query }, options);
export const validateBodyAsync = <S extends ZodType>(body: S, options?: ValidationOptions) =>
  validateAsync({ body }, options);

export default validate;
