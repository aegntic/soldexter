```markdown
# soldexter Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development conventions and workflows used in the `soldexter` TypeScript codebase. You will learn about file naming, import/export styles, commit message patterns, and how to write and run tests. This guide is designed to help contributors quickly adopt the project's standards and efficiently collaborate on new features or bug fixes.

## Coding Conventions

### File Naming
- Use **PascalCase** for all file names.
  - Example: `MyComponent.ts`, `UserService.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { UserService } from './UserService';
    ```

### Export Style
- Use **named exports** exclusively.
  - Example:
    ```typescript
    export function calculateTotal() { ... }
    export const API_URL = '...';
    ```

### Commit Messages
- Follow **Conventional Commits** format.
- Use prefixes such as `docs` to indicate documentation changes.
- Example:
  ```
  docs: update README with installation instructions
  ```

## Workflows

### Documentation Update
**Trigger:** When updating or adding documentation files  
**Command:** `/update-docs`

1. Make your documentation changes in the relevant files.
2. Use a commit message with the `docs` prefix, e.g., `docs: add usage example to README`.
3. Push your changes and open a pull request for review.

### Code Contribution
**Trigger:** When adding new features or fixing bugs  
**Command:** `/contribute-code`

1. Create a new branch for your work.
2. Follow file naming, import, and export conventions.
3. Write or update tests as needed (see Testing Patterns below).
4. Commit your changes using a conventional commit message.
5. Push your branch and open a pull request.

## Testing Patterns

- Test files use the `*.test.*` naming pattern, e.g., `MyComponent.test.ts`.
- The testing framework is not specified; follow existing test file patterns.
- Example test file:
  ```typescript
  import { calculateTotal } from './calculateTotal';

  test('calculates total correctly', () => {
    expect(calculateTotal([1, 2, 3])).toBe(6);
  });
  ```

## Commands
| Command           | Purpose                                    |
|-------------------|--------------------------------------------|
| /update-docs      | Start the documentation update workflow    |
| /contribute-code  | Start the code contribution workflow       |
```
