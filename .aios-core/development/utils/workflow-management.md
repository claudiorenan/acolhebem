# Workflow Management Utils

## Plan Status Tracking

Plans are stored in `.aios-core/cache/plans/` as YAML files.

### Plan States
- `draft` - Being created
- `active` - In execution
- `paused` - Temporarily halted
- `completed` - All steps done
- `cancelled` - Abandoned

### Plan Structure
```yaml
id: plan-{timestamp}
name: Plan Name
status: draft
created: ISO-date
steps:
  - id: step-1
    description: Step description
    status: pending
    agent: agent-name
    dependencies: []
```

## Workflow Execution

### Sequential Workflow
Steps execute one after another, each waiting for the previous to complete.

### Parallel Workflow
Independent steps execute simultaneously, with sync points for dependencies.

### Conditional Workflow
Steps execute based on conditions from previous step outputs.
