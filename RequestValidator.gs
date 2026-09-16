/**
 * Validador de entrada inspirado em JSON Schema, sem dependencias externas.
 * Suporta: type, required, properties, items, enum, pattern, format,
 * minLength, maxLength, minimum, maximum e additionalProperties.
 */
var RequestValidator = (function () {
  'use strict';

  function validate(value, schema) {
    var errors = [];
    validateNode_(value, schema || {}, '$', errors);
    return { valid: errors.length === 0, errors: errors };
  }

  function validateOrError(value, schema, requestId) {
    var result = validate(value, schema);
    return result.valid ? null : ApiError.validation(result.errors, null, requestId);
  }

  function validateNode_(value, schema, path, errors) {
    try {
      if (schema.required === true && (value === undefined || value === null || value === '')) {
        add_(errors, path, 'required', 'Campo obrigatorio.');
        return;
      }
      if (value === undefined || value === null) return;

      if (schema.type && !isType_(value, schema.type)) {
        add_(errors, path, 'type', 'Tipo esperado: ' + schema.type + '.');
        return;
      }
      if (schema.enum && schema.enum.indexOf(value) === -1) {
        add_(errors, path, 'enum', 'Valor nao permitido.');
      }
      if (typeof value === 'string') validateString_(value, schema, path, errors);
      if (typeof value === 'number') validateNumber_(value, schema, path, errors);
      if (Array.isArray(value) && schema.items) {
        value.forEach(function (item, index) {
          validateNode_(item, schema.items, path + '[' + index + ']', errors);
        });
      }
      if (isPlainObject_(value)) validateObject_(value, schema, path, errors);
    } catch (error) {
      Logger.log("Erro em validateNode_: " + error.message);
      throw error;
    }
  }

  function validateObject_(value, schema, path, errors) {
    try {
      var properties = schema.properties || {};
      (schema.required || []).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(value, key) ||
            value[key] === null || value[key] === '') {
          add_(errors, path + '.' + key, 'required', 'Campo obrigatorio.');
        }
      });
      Object.keys(properties).forEach(function (key) {
        validateNode_(value[key], properties[key], path + '.' + key, errors);
      });
      if (schema.additionalProperties === false) {
        Object.keys(value).forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(properties, key)) {
            add_(errors, path + '.' + key, 'additionalProperties', 'Campo nao reconhecido.');
          }
        });
      }
    } catch (error) {
      Logger.log("Erro em validateObject_: " + error.message);
      throw error;
    }
  }

  function validateString_(value, schema, path, errors) {
    if (schema.minLength != null && value.length < schema.minLength) {
      add_(errors, path, 'minLength', 'Tamanho minimo: ' + schema.minLength + '.');
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      add_(errors, path, 'maxLength', 'Tamanho maximo: ' + schema.maxLength + '.');
    }
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) {
      add_(errors, path, 'pattern', 'Formato invalido.');
    }
    if (schema.format === 'email' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      add_(errors, path, 'format', 'Email invalido.');
    }
  }

  function validateNumber_(value, schema, path, errors) {
    if (schema.minimum != null && value < schema.minimum) {
      add_(errors, path, 'minimum', 'Valor minimo: ' + schema.minimum + '.');
    }
    if (schema.maximum != null && value > schema.maximum) {
      add_(errors, path, 'maximum', 'Valor maximo: ' + schema.maximum + '.');
    }
  }

  function isType_(value, type) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return isPlainObject_(value);
    if (type === 'integer') return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    if (type === 'number') return typeof value === 'number' && isFinite(value);
    return typeof value === type;
  }

  function isPlainObject_(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function add_(errors, field, rule, message) {
    try {
      errors.push({ field: field, rule: rule, message: message });
    } catch (error) {
      Logger.log("Erro em add_: " + error.message);
      throw error;
    }
  }

  return {
    validate: validate,
    validateOrError: validateOrError
  };
}());


// ── Utilitários de Validação Comuns (FROTA-19) ───────────────────────────────

/**
 * Verifica se valor está presente (não null, undefined ou string vazia).
 * @param {*} value
 * @return {boolean}
 */
function isPresent(value) {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Exige que valor esteja presente, lançando ValidationError se ausente.
 * @param {*} value
 * @param {string} fieldName
 * @return {*} O valor (para encadeamento)
 */
function requirePresent(value, fieldName) {
  if (!isPresent(value)) {
    throw new ValidationError(
      'Campo "' + fieldName + '" e obrigatorio',
      fieldName,
      value
    );
  }
  return value;
}

/**
 * Retorna valor ou fallback se ausente.
 * @param {*} value
 * @param {*} fallback
 * @return {*}
 */
function defaultTo(value, fallback) {
  return isPresent(value) ? value : fallback;
}

/**
 * Valida email com verificação de domínio opcional.
 * @param {string} email
 * @param {Object} options - { allowedDomains: Array<string>, requireDomain: boolean }
 * @return {boolean}
 */
function validateEmail(email, options) {
  options = options || {};
  
  if (!email || typeof email !== 'string') return false;
  
  // Regex básico de email
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  
  // Verifica domínio permitido se especificado
  if (options.allowedDomains && options.allowedDomains.length > 0) {
    var domain = email.split('@')[1].toLowerCase();
    var allowed = options.allowedDomains.some(function(d) {
      return domain === d.toLowerCase();
    });
    if (!allowed) return false;
  }
  
  // Exige domínio conhecido se solicitado
  if (options.requireDomain) {
    var knownDomains = [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
      'edu.br', 'gov.br', 'com.br'
    ];
    var domain = email.split('@')[1].toLowerCase();
    var isKnown = knownDomains.some(function(d) {
      return domain.endsWith(d);
    });
    if (!isKnown) return false;
  }
  
  return true;
}

/**
 * Valida CPF (algoritmo oficial).
 * @param {string} cpf
 * @return {boolean}
 */
function validateCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  
  // Remove formatação
  cpf = cpf.replace(/[^\d]/g, '');
  
  if (cpf.length !== 11) return false;
  
  // Rejeita CPFs conhecidos como inválidos
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  
  // Valida dígitos verificadores
  var sum = 0;
  var remainder;
  
  for (var i = 1; i <= 9; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  
  sum = 0;
  for (var i = 1; i <= 10; i++) {
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
}

/**
 * Valida que string contém apenas caracteres seguros (previne injection).
 * @param {string} value
 * @param {Object} options - { allowSpaces: boolean, allowPunctuation: boolean }
 * @return {boolean}
 */
function validateSafeString(value, options) {
  options = options || {};
  
  if (!value || typeof value !== 'string') return false;
  
  var pattern = '^[a-zA-Z0-9';
  if (options.allowSpaces) pattern += '\\s';
  if (options.allowPunctuation) pattern += '.,!?;:\\-_';
  pattern += ']+$';
  
  var regex = new RegExp(pattern);
  return regex.test(value);
}

/**
 * Valida data no formato ISO ou brasileiro.
 * @param {string} dateStr
 * @param {Object} options - { format: 'iso'|'br', minDate: Date, maxDate: Date }
 * @return {boolean}
 */
function validateDate(dateStr, options) {
  options = options || {};
  
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  var date;
  if (options.format === 'br') {
    // DD/MM/YYYY
    var parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    date = new Date(parts[2], parts[1] - 1, parts[0]);
  } else {
    // ISO YYYY-MM-DD
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) return false;
  
  if (options.minDate && date < options.minDate) return false;
  if (options.maxDate && date > options.maxDate) return false;
  
  return true;
}

/**
 * Sanitiza string removendo caracteres perigosos.
 * @param {string} value
 * @param {Object} options - { removeHtml: boolean, removeSql: boolean }
 * @return {string}
 */
function sanitizeString(value, options) {
  options = options || { removeHtml: true, removeSql: true };
  
  if (!value || typeof value !== 'string') return '';
  
  var sanitized = value;
  
  if (options.removeHtml) {
    // Remove tags HTML
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    // Remove caracteres de controle
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  if (options.removeSql) {
    // Remove caracteres comuns em SQL injection
    sanitized = sanitized.replace(/['";\\]/g, '');
  }
  
  return sanitized.trim();
}

/**
 * Valida que número está dentro de range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @return {boolean}
 */
function validateRange(value, min, max) {
  if (typeof value !== 'number' || !isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Valida comprimento de string.
 * @param {string} value
 * @param {number} min
 * @param {number} max
 * @return {boolean}
 */
function validateLength(value, min, max) {
  if (!value || typeof value !== 'string') return false;
  var len = value.length;
  if (min !== undefined && len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
}

// ── Schemas Pré-construídos ───────────────────────────────────────────────────

var CommonSchemas = {
  email: {
    type: 'string',
    format: 'email',
    minLength: 5,
    maxLength: 100
  },
  
  username: {
    type: 'string',
    pattern: '^[a-zA-Z0-9_-]{3,30}$',
    minLength: 3,
    maxLength: 30
  },
  
  password: {
    type: 'string',
    minLength: 8,
    maxLength: 500
  },
  
  cpf: {
    type: 'string',
    pattern: '^\\d{11}$'
  },
  
  phoneNumber: {
    type: 'string',
    pattern: '^\\d{10,11}$'
  },
  
  url: {
    type: 'string',
    pattern: '^https?://.+'
  },
  
  date: {
    type: 'string',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$'
  }
};
