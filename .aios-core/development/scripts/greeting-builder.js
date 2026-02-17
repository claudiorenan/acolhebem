/**
 * AIOS Greeting Builder
 * Builds intelligent greetings for agent activation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let gitConfigCache = null;
let gitConfigCacheTime = 0;

function getGitConfig() {
  const now = Date.now();
  if (gitConfigCache && (now - gitConfigCacheTime) < CACHE_TTL) {
    return gitConfigCache;
  }
  try {
    const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    gitConfigCache = { configured: true, name, email };
  } catch {
    gitConfigCache = { configured: false, name: null, email: null };
  }
  gitConfigCacheTime = now;
  return gitConfigCache;
}

function detectSessionType(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return 'new';
  if (conversationHistory.some(m => m.includes('workflow'))) return 'workflow';
  return 'existing';
}

function getProjectStatus() {
  const root = process.cwd();
  const hasAiosCore = fs.existsSync(path.join(root, '.aios-core'));
  const hasDocs = fs.existsSync(path.join(root, 'docs'));
  const hasPackageJson = fs.existsSync(path.join(root, 'package.json'));
  const storiesDir = path.join(root, 'docs', 'stories');
  let storyCount = 0;
  if (fs.existsSync(storiesDir)) {
    storyCount = fs.readdirSync(storiesDir).filter(f => f.endsWith('.md')).length;
  }
  return { hasAiosCore, hasDocs, hasPackageJson, storyCount };
}

function filterCommandsByVisibility(commands, level = 'quick') {
  const levels = { quick: 5, key: 10, full: Infinity };
  const max = levels[level] || 5;
  return commands.slice(0, max);
}

function buildGreeting(agentDefinition, conversationHistory = []) {
  const agent = agentDefinition.agent || {};
  const persona = agentDefinition.persona_profile || {};
  const sessionType = detectSessionType(conversationHistory);
  const gitConfig = getGitConfig();
  const projectStatus = getProjectStatus();

  const icon = agent.icon || '👑';
  const name = agent.name || 'Agent';
  const archetype = persona.archetype || '';
  const greetingLevels = persona.communication?.greeting_levels || {};

  let greeting = greetingLevels.archetypal || `${icon} ${name} ready!`;

  if (gitConfig.configured && gitConfig.name) {
    greeting += `\nOlá, **${gitConfig.name}**!`;
  }

  if (sessionType === 'workflow') {
    greeting += '\n📋 Workflow em progresso detectado.';
  }

  if (projectStatus.hasAiosCore) {
    greeting += `\n📊 Projeto AIOS inicializado.`;
    if (projectStatus.storyCount > 0) {
      greeting += ` ${projectStatus.storyCount} stories encontradas.`;
    }
  }

  return greeting;
}

module.exports = { buildGreeting, getGitConfig, getProjectStatus, detectSessionType };
