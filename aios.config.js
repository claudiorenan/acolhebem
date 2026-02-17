/**
 * AIOS Configuration - AcolheBem
 * Project-specific settings for Synkra AIOS framework
 */

module.exports = {
  project: {
    name: 'AcolheBem',
    description: 'Plataforma de saúde mental - diretório de psicólogos e triagem inteligente',
    version: '0.1.0',
    language: 'pt-BR',
  },

  framework: {
    version: '2.0',
    coreDir: '.aios-core',
    docsDir: 'docs',
  },

  stack: {
    primary: 'next.js',
    language: 'typescript',
    styling: 'tailwind',
    testing: 'playwright',
  },

  agents: {
    default: 'aios-master',
    activation: '@', // prefix for agent activation
    commandPrefix: '*', // prefix for agent commands
  },

  conventions: {
    commits: 'conventional', // conventional commits
    branches: 'feature/{story-id}-{slug}',
    storyPrefix: 'story',
    storyDir: 'docs/stories',
  },

  development: {
    port: {
      proxy: 4500,
      nextjs: 3000,
    },
    api: {
      baseUrl: 'http://cademeupsi.com.br',
      imageBase: 'https://cademeupsi.com.br/storage/',
    },
  },
};
