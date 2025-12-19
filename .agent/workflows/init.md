---
description: Initialize the project workflow system
---

# Initialize Project Workflows

This workflow sets up the `.agent/workflows` directory structure for your project.

## Steps

1. **Create the workflows directory** (if it doesn't exist)
   ```bash
   mkdir -p .agent/workflows
   ```

2. **Verify the structure**
   - The `.agent/workflows` directory should now exist
   - Workflow files can be added as `.md` files in this directory

## Usage

Workflows help document common tasks and procedures for your project. Each workflow should:
- Have a clear description in the YAML frontmatter
- Provide step-by-step instructions
- Include code examples where applicable
- Use `// turbo` annotations for auto-runnable steps
- Use `// turbo-all` to make all run_command steps auto-runnable

## Example Workflow Format

```markdown
---
description: Example workflow description
---

# Workflow Title

Brief description of what this workflow does.

## Steps

1. First step description
   ```bash
   command-to-run
   ```

// turbo
2. This step will auto-run
   ```bash
   safe-command
   ```
```
