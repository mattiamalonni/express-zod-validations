# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Coverage script and thresholds (`npm run coverage`, provider v8).

### Changed

- Updated dev dependencies: `express` 5.3.0, `vitest` 4.1.12 and `@vitest/coverage-v8` 4.1.12.
  `npm audit` now reports zero vulnerabilities.
- Bumped `actions/checkout` to v7.0.1 and `actions/setup-node` to v7.1.0 in the publish workflow.
- `CHANGELOG.md` is now included in the published npm package.
- Documentation placeholders clarified and type tests now cover Express route registration.

## 0.2.0 - 2026-11-26

### Added

- `validateAsync` and `validateBodyAsync` / `validateParamsAsync` / `validateQueryAsync` /
  `validateHeadersAsync` for schemas with async refinements or transforms.
- Compile-time type tests (`npm run typecheck`) covering schema inference for both sync and async
  validators.
- Tests for per-request config overrides, header casing, undefined bodies and atomicity.
- `sideEffects: false` in `package.json`.

### Changed

- **BREAKING**: `validate` and the `validate*` helpers are now synchronous and use Zod `safeParse`.
  Schemas with async checks must use the `validateAsync` variants.
- Validation results are applied atomically: with `throwErrors: true`, a failing key no longer
  leaves partial values or errors on the request.
- `overwriteRequest` merges parsed headers into `req.headers` instead of replacing it, so standard
  headers such as `host` and `content-type` are preserved.
- Zod dev dependency updated to 4.6.7; development uses Node 22.22 and the publish workflow pins
  npm 11.7.0 and runs the typecheck.

## 0.1.3

- Fixed `overwriteRequest` for `req.query` on Express 5.
- Added generic `ValidationRequest<S>` / `ValidationValues<S>` inference.
- Updated documentation to the Zod v4 API (`issues`, `error`, `ValidationError`).
- Replaced ESLint/Prettier with oxlint/oxfmt using TypeScript configs.
- Added the MIT license and a `prepublishOnly` script.

## 0.1.2

- Updated validation error handling.

## 0.1.1

- Added test scripts.
