# Task: Create Next Story

<!--
task:
  name: create-next-story
  description: Creates the next user story in the stories directory
  elicit: true
  agent: aios-master
-->

## Purpose
Create the next sequentially numbered user story using the story template.

## Steps

### Step 1: Detect Next Story Number
- Scan `docs/stories/` directory
- Find the highest numbered story file
- Increment by 1 for the new story number

### Step 2: Elicit Story Details
```elicit
- question: "Qual é o título da story?"
  type: text
  required: true
- question: "Qual é a persona (usuário)?"
  type: text
  default: "usuário da plataforma"
- question: "Qual é a ação desejada?"
  type: text
  required: true
- question: "Qual é o benefício?"
  type: text
  required: true
- question: "Qual a prioridade?"
  type: select
  options: [Alta, Média, Baixa]
  default: Média
```

### Step 3: Generate Story File
- Load template from `templates/story-tmpl.yaml`
- Fill in elicited values
- Save to `docs/stories/story-{number}-{slug}.md`

### Step 4: Confirm
- Display created story summary
- Show file path

## Validation
- [ ] Story file created with correct number
- [ ] All required fields populated
- [ ] Template structure maintained
