# Brownfield Full-Stack Workflow

<!--
workflow:
  name: brownfield-fullstack
  description: Workflow for evolving the existing AcolheBem full-stack application
  type: sequential
-->

## Overview
Workflow para desenvolvimento incremental no projeto AcolheBem existente (static site + Next.js app).

## Steps

### 1. Analyze Current State
- Agent: @architect
- Review existing codebase and architecture
- Identify integration points
- Document current patterns

### 2. Define Requirements
- Agent: @pm / @po
- Create or review PRD
- Define user stories
- Prioritize backlog

### 3. Plan Architecture Changes
- Agent: @architect
- Design changes considering existing structure
- Plan migration path if needed
- Document API changes

### 4. Implement Features
- Agent: @dev
- Follow story-driven development
- Implement incrementally
- Update story progress

### 5. Quality Assurance
- Agent: @qa
- Write/run tests
- Verify acceptance criteria
- Check for regressions

### 6. Deploy & Review
- Agent: @devops
- Build and deploy
- Monitor for issues
- Post-deployment verification
