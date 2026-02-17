# Task: Create Document

<!--
task:
  name: create-doc
  description: Creates a document from a template
  elicit: true
  agent: aios-master
-->

## Purpose
Create a new document using one of the available templates.

## Steps

### Step 1: Select Template
If no template specified, list available templates:
1. prd-tmpl.yaml - Product Requirements Document
2. architecture-tmpl.yaml - Architecture Document
3. project-brief-tmpl.yaml - Project Brief
4. story-tmpl.yaml - User Story

```elicit
- question: "Qual template deseja usar?"
  type: select
  options: [PRD, Architecture, Project Brief, Story]
  required: true
```

### Step 2: Elicit Document Details
Based on selected template, gather required information:
```elicit
- question: "Qual o título do documento?"
  type: text
  required: true
- question: "Qual o diretório de destino?"
  type: text
  default: "docs/"
```

### Step 3: Generate Document
- Load selected template
- Fill in elicited values
- Save to specified location

### Step 4: Confirm
- Display document summary
- Show file path

## Validation
- [ ] Document created in correct location
- [ ] Template structure maintained
- [ ] Required fields populated
