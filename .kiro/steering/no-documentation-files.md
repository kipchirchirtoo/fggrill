---
inclusion: always
---

# Documentation File Policy

## Rule: Do Not Create Markdown Documentation Files

Do not create markdown files to document your work, fixes, changes, or summaries unless explicitly requested by the user.

### Prohibited File Patterns

- `*_COMPLETE.md`, `*_SUMMARY.md`, `*_GUIDE.md`
- `*_INSTRUCTIONS.md`, `*_FIX.md`, `*_EXPLAINED.md`
- `SESSION_*.md`, `QUICK_START_*.md`, `QUICKSTART_*.md`
- `*_VISUAL_GUIDE.md`, `*_DETAIL_*.md`
- Any similar documentation markdown files

### Rationale

These files create workspace clutter, become outdated quickly, are rarely maintained, and add noise to the file tree without providing lasting value.

### Alternative Approaches

1. **Provide verbal summaries** - Explain changes in your response to the user
2. **Use inline code comments** - Add explanations directly in the code where needed
3. **Update existing documentation** - Only modify README.md or files in existing `/docs` folders when relevant
4. **Commit messages** - Let version control history serve as the record

### Exceptions

Create markdown files only when:
- User explicitly requests documentation (e.g., "create a guide for this")
- Updating an existing README.md or CONTRIBUTING.md
- Working within a pre-existing `/docs` or `/documentation` directory
- Creating spec files in `.kiro/specs/` (part of the spec workflow)

### Implementation Guidance

When completing work:
- Summarize verbally in 2-3 sentences maximum
- Do not create files to recap what was accomplished
- Focus on actionable next steps rather than historical documentation
- Keep the workspace clean and focused on source code
