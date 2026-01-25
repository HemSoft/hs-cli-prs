# AI Agent Guidelines for hs-cli-template

> Strategic guidance for AI agents working with this CLI template repository

## Project Mission

This repository is the **canonical HemSoft CLI template** - the foundation for all CLI tools built under the HemSoft Developments brand. It establishes patterns, quality standards, and architectural decisions that propagate to all derived CLI tools.

**Your Role**: When working on this repository, you're not just editing code - you're shaping the foundation that dozens of CLI tools will inherit. Every change here has a multiplier effect.

## Core Principles

### 1. **Template First, Application Second**
- This is a template repository, not a standalone application
- Changes should benefit ALL future CLI tools, not just one use case
- Favor configurability over hard-coding
- Include examples but make them easy to replace

### 2. **Developer Experience is Paramount**
- CLI authors should be able to customize quickly
- Patterns should be obvious and consistent
- Documentation should be comprehensive
- Defaults should be sensible but overridable

### 3. **Quality is Non-Negotiable**
- Pre-commit hooks enforce standards automatically
- TypeScript strict mode catches errors early
- Every command should handle errors gracefully
- All resources must be cleaned up (no leaks)

### 4. **Branded, Beautiful, Professional**
- Terminal output should delight users
- Consistent use of colors, symbols, and formatting
- Help text should be readable and well-structured
- Every interaction should feel polished

## Architecture Philosophy

### Separation of Concerns

```
src/
├── index.ts           # CLI framework only - no business logic
├── commands/          # Command implementations - one file per command
│   ├── auth.ts       # Authentication (mostly template-agnostic)
│   ├── config.ts     # Configuration (mostly template-agnostic)
│   └── hello.ts      # Demo (should be replaced by CLI authors)
└── lib/              # Reusable services - shared across commands
    ├── ai.ts         # AI abstraction
    ├── banner.ts     # Branding and UI
    └── config.ts     # Configuration storage
```

**Key Insight**: `commands/` contains command-specific logic. `lib/` contains reusable services. `index.ts` only wires things together.

### Service-Oriented Design

Each service in `lib/` should:
- Have a single, clear responsibility
- Be independently testable
- Manage its own resources (open/close paradigm)
- Expose a simple, intuitive API

**Example**: `AIService` manages Copilot SDK lifecycle - commands just call `prompt()` and `close()`.

### Error Handling Strategy

```typescript
// Standard pattern for all commands
export async function someCommand(options: Options) {
  const ai = new AIService(systemPrompt, options.model);
  const spinner = ora();

  try {
    // 1. Validate inputs early
    // 2. Provide progress feedback
    // 3. Perform operations
    // 4. Report success
  } catch (error) {
    // Always fail visibly with context
    spinner.fail('Operation failed');
    console.error(chalk.red(logSymbols.error), error.message);
    process.exit(1);
  } finally {
    // Always clean up resources
    await ai.close();
  }
}
```

**Philosophy**: Fail fast, fail loudly, clean up always.

## Development Workflow

### Making Changes to the Template

1. **Consider Impact**: Will this change affect existing CLI tools using the template?
2. **Document**: Update README.md, code comments, and this file
3. **Test Thoroughly**: The template must work out-of-the-box
4. **Consider Migration**: If breaking, document how to migrate

### Quality Gates (Automated)

- **Pre-commit**: ESLint + Prettier run automatically via Husky
- **Type-check**: `npm run check` validates TypeScript
- **Manual Testing**: `npm run dev` should work for all commands

### Code Style Standards

- **TypeScript**: Strict mode, explicit types, no `any`
- **Formatting**: Prettier handles all formatting (don't fight it)
- **Naming**: 
  - Files: kebab-case (`my-command.ts`)
  - Functions: camelCase (`myFunction`)
  - Interfaces: PascalCase (`MyOptions`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)

### Import Conventions

```typescript
// Always use .js extension for local imports (TypeScript requirement)
import { AIService } from '../lib/ai.js';
import { config } from '../lib/config.js';

// External imports - no extension
import chalk from 'chalk';
import ora from 'ora';
```

## Adding Features

### When to Add to Template

✅ **Add when**:
- Feature benefits most CLI tools (auth, config, help styling)
- It's a common pattern (command structure, error handling)
- It improves developer experience (better defaults, clearer examples)
- It enforces quality (pre-commit hooks, strict TypeScript)

❌ **Don't add when**:
- It's specific to one CLI tool's domain
- It adds significant complexity for rare use cases
- It's experimental or unstable
- It creates tight coupling to external services

### Feature Integration Checklist

When adding a new feature:
- [ ] Does it have a clear, single responsibility?
- [ ] Is it documented in README.md?
- [ ] Does it work cross-platform (Windows, macOS, Linux)?
- [ ] Is error handling comprehensive?
- [ ] Are resources cleaned up properly?
- [ ] Does it follow existing patterns?
- [ ] Is the API intuitive for CLI authors?
- [ ] Are sensible defaults provided?

## Common Tasks for Agents

### Task: Add a New Command Template

1. Create `src/commands/example-command.ts` following the standard pattern
2. Register in `src/index.ts` with proper help text
3. Update README.md with usage example
4. Test with `npm run dev example-command`

### Task: Update Dependencies

1. Review breaking changes in dependency changelogs
2. Update `package.json` version
3. Test that `npm install` works cleanly
4. Verify pre-commit hooks still work
5. Update README if usage changes

### Task: Improve Error Messages

1. Find the error being thrown
2. Add context: what failed, why, what to try next
3. Use appropriate log symbol (error, warning, info)
4. Use appropriate color (red for errors, yellow for warnings)
5. Test the error path end-to-end

### Task: Refactor for Maintainability

**Before refactoring**:
- Understand why the current code exists
- Ensure tests pass (or write tests first)
- Check if pattern is used elsewhere

**During refactoring**:
- Maintain backward compatibility if possible
- Update all affected files
- Keep commits logical and atomic

**After refactoring**:
- Update documentation
- Test all affected commands
- Verify quality checks pass

## Testing Strategy

Currently manual testing; consider adding:
- Unit tests for `lib/` services
- Integration tests for commands
- Snapshot tests for help output
- E2E tests for complete workflows

**For now**: Test manually with `npm run dev` before committing.

## Security Considerations

### Authentication
- Never store tokens in code or config
- Rely on GitHub CLI (`gh`) for credential management
- Document auth requirements clearly
- Support multi-account scenarios

### Dependencies
- Regularly update dependencies for security patches
- Vet new dependencies carefully (npm audit)
- Prefer well-maintained, popular packages
- Document any security-sensitive dependencies

### User Data
- Config should be user-readable JSON
- Never store sensitive data in config
- Document what data is persisted where

## Working with GitHub Copilot SDK

The template integrates GitHub Copilot CLI SDK for AI capabilities:

### Best Practices

1. **Always close sessions**: Use try/finally pattern
2. **Customize system messages**: Different per command
3. **Handle auth gracefully**: Check and guide users
4. **Respect model selection**: Honor user's config and overrides
5. **Error recovery**: Provide clear next steps on auth failures

### Common Patterns

```typescript
// Custom system message for domain-specific tasks
const ai = new AIService(
  'You are an expert code reviewer. Provide constructive feedback.',
  options.model
);

// Multi-turn conversations
const response1 = await ai.prompt('First question');
const response2 = await ai.prompt('Follow-up based on: ' + response1);

// Always clean up
await ai.close();
```

## Documentation Standards

### Code Comments

- Explain **why**, not **what** (code shows what)
- Use JSDoc for public APIs
- Include examples for complex functions
- Keep comments up-to-date with code changes

### README.md

- Keep "Quick Start" concise and tested
- Document all available commands
- Show examples for common use cases
- Maintain architecture diagram if needed
- Update customization guide when adding options

### Inline Documentation

Help text should be:
- Concise but complete
- Include examples where helpful
- Formatted consistently
- User-friendly (avoid jargon)

## Troubleshooting for Agents

### Issue: Pre-commit hooks not running

**Check**: 
1. Is Husky installed? (`npm install`)
2. Does `.husky/pre-commit` exist?
3. Try: `npm run prepare`

### Issue: TypeScript errors

**Check**:
1. Run `npm run type-check` for details
2. Are imports using `.js` extension?
3. Are types exported/imported correctly?
4. Is `strict: true` causing issues?

### Issue: Auth not working

**Check**:
1. Is `gh` CLI installed?
2. Is user authenticated? (`gh auth status`)
3. Does user have Copilot access?
4. Check error message for specifics

### Issue: Build succeeds but runtime fails

**Check**:
1. Are imports using `.js` extension?
2. Is `type: "module"` in package.json?
3. Are all dependencies installed?
4. Check Node version (>=18.0.0)

## Version Strategy

Follow semantic versioning:
- **Patch** (1.0.x): Bug fixes, doc updates, minor improvements
- **Minor** (1.x.0): New features, non-breaking changes
- **Major** (x.0.0): Breaking changes, major rewrites

**Current Status**: v1.0.0 - Initial stable release

## Contributing Mindset

When you make changes:

1. **Think Template-First**: Will this help future CLI authors?
2. **Maintain Patterns**: Consistency > cleverness
3. **Document Well**: Future you will thank present you
4. **Test Thoroughly**: This template propagates to many tools
5. **Keep It Simple**: Complexity is technical debt

## Success Metrics

A successful template change:
- ✅ Works out of the box with `npm install && npm run dev`
- ✅ Passes all quality checks (`npm run check`)
- ✅ Is well-documented in README and code
- ✅ Follows established patterns
- ✅ Makes CLI authoring easier, not harder

## Questions to Ask Before Committing

1. Does this belong in the template or a specific CLI tool?
2. Will this work for someone starting from scratch?
3. Is the documentation clear for first-time users?
4. Have I tested the full workflow end-to-end?
5. Are there any breaking changes? Are they documented?
6. Does this align with HemSoft branding standards?

---

**Remember**: This template is infrastructure. Treat it with the care and rigor you'd give to any critical system that others depend on.
