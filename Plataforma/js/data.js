/**
 * AcolheBem - Dados dos Grupos de Acolhimento
 * Cada tópico = 1 grupo WhatsApp
 * Subtópicos = temas tratados dentro do grupo
 */

const TOPICS_DATA = {
  women: {
    title: 'Grupos de Acolhimento — Mulheres',
    subtitle: 'Espaços seguros para acolher, compartilhar e crescer juntas',
    icon: '♀',
    accentColor: '#d6336c',
    bgGradient: ['#fce4ec', '#f8bbd0'],
    categories: [
      {
        id: 1,
        title: 'Ansiedade e Sobrecarga Emocional',
        icon: '🧠',
        color: '#7c3aed',
        colorLight: '#ede9fe',
        description: 'Grupo para quem sente o peso do mundo nos ombros',
        link: 'https://chat.whatsapp.com/GRUPO_F_ANSIEDADE',
        subtopics: [
          { name: 'Ansiedade generalizada', emoji: '😰' },
          { name: 'Sobrecarga mental (trabalho, casa, filhos)', emoji: '🤯' },
          { name: 'Perfeccionismo', emoji: '✨' },
          { name: 'Medo de julgamento', emoji: '👀' },
          { name: 'Síndrome da impostora', emoji: '🎭' }
        ]
      },
      {
        id: 2,
        title: 'Relacionamentos e Autoestima',
        icon: '💕',
        color: '#ec4899',
        colorLight: '#fce7f3',
        description: 'Aprenda a se amar e construir relações saudáveis',
        link: 'https://chat.whatsapp.com/GRUPO_F_RELACIONAMENTOS',
        subtopics: [
          { name: 'Dependência emocional', emoji: '🔗' },
          { name: 'Dificuldades em relacionamentos amorosos', emoji: '💔' },
          { name: 'Autoimagem e insegurança', emoji: '🪞' },
          { name: 'Necessidade de aprovação', emoji: '👍' },
          { name: 'Medo de abandono', emoji: '😢' }
        ]
      },
      {
        id: 3,
        title: 'Corpo, Alimentação e Imagem',
        icon: '🪞',
        color: '#f43f5e',
        colorLight: '#ffe4e6',
        description: 'Reconecte-se com seu corpo de forma gentil',
        link: 'https://chat.whatsapp.com/GRUPO_F_CORPO',
        subtopics: [
          { name: 'Transtornos alimentares', emoji: '🍽️' },
          { name: 'Pressão estética', emoji: '💄' },
          { name: 'Insatisfação corporal', emoji: '🫂' },
          { name: 'Comparação com redes sociais', emoji: '📱' }
        ]
      },
      {
        id: 4,
        title: 'Maternidade e Vida Familiar',
        icon: '👶',
        color: '#f59e0b',
        colorLight: '#fef3c7',
        description: 'Ser mãe é lindo, mas também pode ser difícil',
        link: 'https://chat.whatsapp.com/GRUPO_F_MATERNIDADE',
        subtopics: [
          { name: 'Exaustão materna', emoji: '😴' },
          { name: 'Culpa na maternidade', emoji: '💭' },
          { name: 'Depressão pós-parto', emoji: '🌧️' },
          { name: 'Conflitos familiares', emoji: '🏠' },
          { name: 'Sobrecarga com filhos', emoji: '👧' }
        ]
      },
      {
        id: 5,
        title: 'Violência e Traumas',
        icon: '🛡️',
        color: '#ef4444',
        colorLight: '#fee2e2',
        description: 'Você não está sozinha. Aqui é um espaço seguro',
        link: 'https://chat.whatsapp.com/GRUPO_F_VIOLENCIA',
        subtopics: [
          { name: 'Violência psicológica', emoji: '🗣️' },
          { name: 'Violência física', emoji: '🚨' },
          { name: 'Relacionamentos abusivos', emoji: '⛓️' },
          { name: 'Traumas de infância', emoji: '🧸' },
          { name: 'Assédio', emoji: '🚫' }
        ]
      }
    ]
  },
  men: {
    title: 'Grupos de Acolhimento — Homens',
    subtitle: 'Força também é pedir ajuda. Aqui você pode ser você',
    icon: '♂',
    accentColor: '#1971c2',
    bgGradient: ['#e3f2fd', '#bbdefb'],
    categories: [
      {
        id: 1,
        title: 'Pressão Financeira e Profissional',
        icon: '💼',
        color: '#3b82f6',
        colorLight: '#dbeafe',
        description: 'O peso de ser provedor não precisa ser carregado sozinho',
        link: 'https://chat.whatsapp.com/BK0KLgwLZUnJRxOyhEIxmg',
        subtopics: [
          { name: 'Ansiedade financeira', emoji: '💰' },
          { name: 'Pressão para ser provedor', emoji: '🏋️' },
          { name: 'Frustração profissional', emoji: '📉' },
          { name: 'Medo do fracasso', emoji: '😟' },
          { name: 'Burnout', emoji: '🔥' }
        ]
      },
      {
        id: 2,
        title: 'Dificuldade em Expressar Emoções',
        icon: '🎭',
        color: '#14b8a6',
        colorLight: '#ccfbf1',
        description: 'Sentir é humano. Expressar é libertador',
        link: 'https://chat.whatsapp.com/DPlhxJEahvm6rSLesfwEm9',
        subtopics: [
          { name: 'Repressão emocional', emoji: '🤐' },
          { name: 'Dificuldade em pedir ajuda', emoji: '🤝' },
          { name: 'Solidão emocional', emoji: '🏝️' },
          { name: 'Raiva como válvula de escape', emoji: '😤' },
          { name: 'Medo de parecer fraco', emoji: '💪' }
        ]
      },
      {
        id: 3,
        title: 'Vícios e Comportamentos Compulsivos',
        icon: '⛓️',
        color: '#f59e0b',
        colorLight: '#fef3c7',
        description: 'Reconhecer é o primeiro passo para a liberdade',
        link: 'https://chat.whatsapp.com/DXkYvqraFMaDf99z6MwlN1',
        subtopics: [
          { name: 'Alcoolismo', emoji: '🍺' },
          { name: 'Jogos e apostas', emoji: '🎰' },
          { name: 'Dependência digital', emoji: '📱' },
          { name: 'Uso de substâncias', emoji: '💊' },
          { name: 'Workaholism', emoji: '⏰' }
        ]
      },
      {
        id: 4,
        title: 'Relacionamentos e Paternidade',
        icon: '👨‍👧',
        color: '#6366f1',
        colorLight: '#e0e7ff',
        description: 'Ser presente é a maior força que existe',
        link: 'https://chat.whatsapp.com/L0hSQYy5Sra5rXULpwAoAe',
        subtopics: [
          { name: 'Dificuldade de intimidade', emoji: '💑' },
          { name: 'Paternidade e ausência', emoji: '👶' },
          { name: 'Conflitos no casamento', emoji: '💍' },
          { name: 'Medo de compromisso', emoji: '😰' },
          { name: 'Solidão', emoji: '🚶' }
        ]
      },
      {
        id: 5,
        title: 'Identidade e Propósito',
        icon: '🧭',
        color: '#10b981',
        colorLight: '#d1fae5',
        description: 'Encontre quem você realmente é, além das expectativas',
        link: '#', // placeholder — link ainda não disponível
        subtopics: [
          { name: 'Crise de identidade', emoji: '🔍' },
          { name: 'Falta de propósito', emoji: '🧭' },
          { name: 'Pressão da masculinidade', emoji: '🎭' },
          { name: 'Comparação e competição', emoji: '🏆' },
          { name: 'Medo de vulnerabilidade', emoji: '🫣' }
        ]
      }
    ]
  }
};

// Grupo geral + link parceiro
const GENERAL_GROUP = {
  title: 'Quem Cuida de Quem Cuida',
  description: 'Grupo geral de acolhimento para todos que buscam apoio',
  icon: '💚',
  link: 'https://chat.whatsapp.com/Dgr1B1qgoyhEMRQ6yaHaYh'
};

const MOVIMENTAR_GROUP = {
  title: 'Projeto MeMovimentar',
  description: 'Grupo de incentivo para as pessoas fazerem exercícios físicos para combater o sedentarismo',
  icon: '🏃',
  link: 'https://chat.whatsapp.com/Cv2W1QzuPFB6tuOLxMjMB4'
};

const PARTNER_LINK = {
  title: 'Encontre um psicólogo parceiro do projeto',
  url: 'https://quemcuidadequemcuida.com.br/',
  icon: '🧑‍⚕️'
};

const LOADING_MESSAGES = [
  { text: 'Preparando seu espaço de acolhimento...', progress: 20 },
  { text: 'Organizando os grupos de apoio...', progress: 50 },
  { text: 'Criando um ambiente seguro para você...', progress: 80 },
  { text: 'Tudo pronto! Seja bem-vindo(a) 💚', progress: 100 }
];
