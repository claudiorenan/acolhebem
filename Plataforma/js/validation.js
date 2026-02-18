/**
 * AcolheBem — Validation Module
 * Client-side input validation with visual feedback.
 */

const Validation = {
  // --- Rules ---

  rules: {
    name: { min: 2, max: 100, label: 'Nome' },
    email: { max: 254, label: 'Email' },
    password: { min: 8, max: 128, label: 'Senha' },
    whatsapp: { label: 'WhatsApp' },
    bio: { max: 500, label: 'Bio' },
    postContent: { min: 1, max: 5000, label: 'Publicacao' },
    replyContent: { min: 1, max: 500, label: 'Resposta' },
    topicName: { min: 2, max: 60, label: 'Nome do tema' },
    topicDescription: { max: 200, label: 'Descricao' },
    topicEmoji: { max: 4, label: 'Emoji' },
    city: { max: 100, label: 'Cidade' },
    messageContent: { min: 1, max: 2000, label: 'Mensagem' },
  },

  avatar: {
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },

  _emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  _whatsappRegex: /^\d{10,11}$/,

  // --- Core Validators ---

  /**
   * Validate a text field.
   * @param {string} value
   * @param {string} ruleName - key in this.rules
   * @returns {{ valid: boolean, error: string|null }}
   */
  text(value, ruleName) {
    const rule = this.rules[ruleName];
    if (!rule) return { valid: true, error: null };

    const trimmed = (value || '').trim();
    const label = rule.label || ruleName;

    if (rule.min && trimmed.length < rule.min) {
      return { valid: false, error: `${label} deve ter pelo menos ${rule.min} caracteres.` };
    }
    if (rule.max && trimmed.length > rule.max) {
      return { valid: false, error: `${label} deve ter no maximo ${rule.max} caracteres.` };
    }
    return { valid: true, error: null };
  },

  /**
   * Validate a required text field (non-empty + rules).
   */
  required(value, ruleName) {
    const trimmed = (value || '').trim();
    const rule = this.rules[ruleName];
    const label = rule ? rule.label : ruleName;

    if (!trimmed) {
      return { valid: false, error: `${label} e obrigatorio.` };
    }
    return this.text(value, ruleName);
  },

  /**
   * Validate email format.
   */
  email(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Email e obrigatorio.' };
    }
    if (trimmed.length > 254) {
      return { valid: false, error: 'Email muito longo.' };
    }
    if (!this._emailRegex.test(trimmed)) {
      return { valid: false, error: 'Email invalido.' };
    }
    return { valid: true, error: null };
  },

  /**
   * Validate password.
   */
  password(value) {
    const val = value || '';
    if (!val) {
      return { valid: false, error: 'Senha e obrigatoria.' };
    }
    if (val.length < 8) {
      return { valid: false, error: 'Senha deve ter pelo menos 8 caracteres.' };
    }
    if (val.length > 128) {
      return { valid: false, error: 'Senha muito longa.' };
    }
    return { valid: true, error: null };
  },

  /**
   * Validate Brazilian WhatsApp number (digits only, 10-11 digits).
   */
  whatsapp(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'WhatsApp e obrigatorio.' };
    }
    const digits = trimmed.replace(/\D/g, '');
    if (!this._whatsappRegex.test(digits)) {
      return { valid: false, error: 'WhatsApp invalido. Use DDD + numero (10 ou 11 digitos).' };
    }
    return { valid: true, error: null };
  },

  /**
   * Validate birth year.
   */
  birthYear(value) {
    if (!value && value !== 0) return { valid: true, error: null }; // optional
    const year = parseInt(value, 10);
    if (isNaN(year)) {
      return { valid: false, error: 'Ano de nascimento invalido.' };
    }
    const currentYear = new Date().getFullYear();
    if (year < 1920 || year > currentYear - 10) {
      return { valid: false, error: `Ano deve ser entre 1920 e ${currentYear - 10}.` };
    }
    return { valid: true, error: null };
  },

  /**
   * Validate avatar file (type + size).
   * @param {File} file
   * @returns {{ valid: boolean, error: string|null }}
   */
  avatarFile(file) {
    if (!file) return { valid: true, error: null };

    if (!this.avatar.allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato invalido. Use JPG, PNG, WebP ou GIF.' };
    }
    if (file.size > this.avatar.maxSizeBytes) {
      const maxMB = this.avatar.maxSizeBytes / (1024 * 1024);
      return { valid: false, error: `Imagem muito grande. Maximo ${maxMB}MB.` };
    }
    return { valid: true, error: null };
  },

  // --- Form Validation ---

  /**
   * Validate signup form fields.
   * @param {object} fields - { name, email, password, whatsapp, bio, birthYear }
   * @returns {{ valid: boolean, errors: object }}
   */
  signup(fields) {
    const errors = {};

    const nameResult = this.required(fields.name, 'name');
    if (!nameResult.valid) errors.name = nameResult.error;

    const emailResult = this.email(fields.email);
    if (!emailResult.valid) errors.email = emailResult.error;

    const passResult = this.password(fields.password);
    if (!passResult.valid) errors.password = passResult.error;

    const wpResult = this.whatsapp(fields.whatsapp);
    if (!wpResult.valid) errors.whatsapp = wpResult.error;

    if (fields.bio) {
      const bioResult = this.text(fields.bio, 'bio');
      if (!bioResult.valid) errors.bio = bioResult.error;
    }

    if (fields.birthYear) {
      const byResult = this.birthYear(fields.birthYear);
      if (!byResult.valid) errors.birthYear = byResult.error;
    }

    if (fields.city) {
      const cityResult = this.text(fields.city, 'city');
      if (!cityResult.valid) errors.city = cityResult.error;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  /**
   * Validate profile edit form fields.
   */
  profileEdit(fields) {
    const errors = {};

    const nameResult = this.required(fields.name, 'name');
    if (!nameResult.valid) errors.name = nameResult.error;

    const wpResult = this.whatsapp(fields.whatsapp);
    if (!wpResult.valid) errors.whatsapp = wpResult.error;

    if (fields.bio) {
      const bioResult = this.text(fields.bio, 'bio');
      if (!bioResult.valid) errors.bio = bioResult.error;
    }

    if (fields.birthYear) {
      const byResult = this.birthYear(fields.birthYear);
      if (!byResult.valid) errors.birthYear = byResult.error;
    }

    if (fields.city) {
      const cityResult = this.text(fields.city, 'city');
      if (!cityResult.valid) errors.city = cityResult.error;
    }

    if (fields.avatarFile) {
      const avResult = this.avatarFile(fields.avatarFile);
      if (!avResult.valid) errors.avatar = avResult.error;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  /**
   * Validate topic creation fields.
   */
  topicCreate(fields) {
    const errors = {};

    const nameResult = this.required(fields.name, 'topicName');
    if (!nameResult.valid) errors.name = nameResult.error;

    if (fields.emoji) {
      const emojiResult = this.text(fields.emoji, 'topicEmoji');
      if (!emojiResult.valid) errors.emoji = emojiResult.error;
    }

    if (fields.description) {
      const descResult = this.text(fields.description, 'topicDescription');
      if (!descResult.valid) errors.description = descResult.error;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  // --- UI Feedback ---

  /**
   * Show validation error on a field.
   * @param {HTMLElement} field - the input/textarea element
   * @param {string} message - error message
   */
  showFieldError(field, message) {
    if (!field) return;
    field.classList.add('field-invalid');
    field.classList.remove('field-valid');

    // Remove existing error message
    this._removeFieldError(field);

    const msg = document.createElement('div');
    msg.className = 'field-error-msg';
    msg.textContent = message;
    field.parentNode.insertBefore(msg, field.nextSibling);
  },

  /**
   * Clear validation error on a field.
   */
  clearFieldError(field) {
    if (!field) return;
    field.classList.remove('field-invalid');
    this._removeFieldError(field);
  },

  /**
   * Mark field as valid.
   */
  markFieldValid(field) {
    if (!field) return;
    field.classList.remove('field-invalid');
    field.classList.add('field-valid');
    this._removeFieldError(field);
  },

  /**
   * Clear all validation errors within a form/container.
   * @param {HTMLElement} container
   */
  clearAll(container) {
    if (!container) return;
    container.querySelectorAll('.field-invalid').forEach(el => {
      el.classList.remove('field-invalid');
      el.classList.remove('field-valid');
    });
    container.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  },

  /**
   * Apply errors object to form fields.
   * @param {object} errors - { fieldKey: errorMessage }
   * @param {object} fieldMap - { fieldKey: HTMLElement }
   * @returns {string|null} first error message (for legacy error elements)
   */
  applyErrors(errors, fieldMap) {
    let firstError = null;
    for (const [key, message] of Object.entries(errors)) {
      if (!firstError) firstError = message;
      const field = fieldMap[key];
      if (field) {
        this.showFieldError(field, message);
      }
    }
    return firstError;
  },

  // --- Internal ---

  _removeFieldError(field) {
    const next = field.nextElementSibling;
    if (next && next.classList.contains('field-error-msg')) {
      next.remove();
    }
  },
};
