import {
  CHINA_PROVINCES,
  TARGET_PROVINCE_NAMES,
} from '../../config/provinces.js';

/**
 * Match business address against Chinese provincial-level divisions.
 * Province full names are checked before city keywords.
 */
export function matchProvince(address) {
  if (!address || typeof address !== 'string') {
    return null;
  }

  const normalized = address.trim();

  for (const province of CHINA_PROVINCES) {
    const provinceName = province.keywords[0];
    if (normalized.includes(provinceName)) {
      return province.name;
    }

    const englishName = province.keywords[1];
    if (englishName && new RegExp(`\\b${escapeRegex(englishName)}\\b`, 'i').test(normalized)) {
      return province.name;
    }
  }

  for (const province of CHINA_PROVINCES) {
    for (const keyword of province.keywords.slice(2)) {
      if (keyword.length >= 2 && normalized.toLowerCase().includes(keyword.toLowerCase())) {
        return province.name;
      }
    }
  }

  return null;
}

export function parseExcludeProvinces(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @returns {'include' | 'exclude' | 'all'}
 */
export function parseProvinceMode(options = {}) {
  if (options.allFbm || options.exportAll || options.provinceMode === 'all') {
    return 'all';
  }
  if (options.provinceMode === 'exclude' || parseExcludeProvinces(options.excludeProvinces).length > 0) {
    return 'exclude';
  }
  if (options.provinceMode === 'include') {
    return 'include';
  }
  return 'include';
}

export function buildProvinceFilter(options = {}) {
  const mode = parseProvinceMode(options);
  return {
    mode,
    excludeProvinces: parseExcludeProvinces(options.excludeProvinces),
  };
}

/**
 * Decide whether a seller address should be exported.
 * @returns {{ export: boolean, matchedProvince: string }}
 */
export function evaluateProvinceFilter(address, filter) {
  const matchedProvince = matchProvince(address) || '';

  if (filter.mode === 'all') {
    return { export: true, matchedProvince };
  }

  if (filter.mode === 'exclude') {
    if (!matchedProvince) {
      return { export: false, matchedProvince: '' };
    }
    const excluded = new Set(filter.excludeProvinces);
    return { export: !excluded.has(matchedProvince), matchedProvince };
  }

  if (matchedProvince && TARGET_PROVINCE_NAMES.has(matchedProvince)) {
    return { export: true, matchedProvince };
  }

  return { export: false, matchedProvince: '' };
}

export function isTargetProvince(address) {
  return evaluateProvinceFilter(address, { mode: 'include', excludeProvinces: [] }).export;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
