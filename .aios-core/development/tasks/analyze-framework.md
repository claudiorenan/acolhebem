# Task: Analyze Framework

<!--
task:
  name: analyze-framework
  description: Analyzes the AIOS framework structure and reports on components
  elicit: false
  agent: aios-master
-->

## Purpose
Analyze the current state of the AIOS framework installation and project structure.

## Steps

### Step 1: Scan Framework Structure
- Check `.aios-core/` directory tree
- List all agents, tasks, workflows, templates, checklists
- Identify missing or incomplete components

### Step 2: Analyze Project Integration
- Check docs/ structure
- Verify story files
- Check configuration files

### Step 3: Generate Report
Output a structured report with:
- Component counts by type
- Missing required components
- Configuration status
- Recommendations

## Output Format
```
📊 AIOS Framework Analysis
==========================
Agents:     {count} defined
Tasks:      {count} available
Workflows:  {count} configured
Templates:  {count} available
Checklists: {count} available
Stories:    {count} in docs/stories/
Config:     {status}

⚠️ Issues Found:
- {issue_list}

💡 Recommendations:
- {recommendation_list}
```
