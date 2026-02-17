# Task: Execute Checklist

<!--
task:
  name: execute-checklist
  description: Runs through a checklist interactively
  elicit: true
  agent: aios-master
-->

## Purpose
Execute a checklist step by step, tracking completion status.

## Steps

### Step 1: Select Checklist
If no checklist specified, list available:
1. story-dod-checklist.md - Story Definition of Done
2. change-checklist.md - Change Checklist
3. story-draft-checklist.md - Story Draft Checklist

### Step 2: Load Checklist
- Read checklist file
- Parse all checklist items
- Display total items count

### Step 3: Execute Items
For each checklist item:
```elicit
- question: "{item_text}"
  type: confirm
  options: [Done, Skip, N/A]
```

### Step 4: Generate Report
- Show completion percentage
- List skipped/N/A items
- Provide pass/fail status

## Validation
- [ ] All items reviewed
- [ ] Report generated
