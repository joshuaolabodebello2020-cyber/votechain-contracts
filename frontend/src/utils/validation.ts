export const MAX_TITLE_LEN = 128;
export const MAX_DESC_LEN = 1024;
export const MIN_DURATION = 60;
export const MAX_DURATION = 2592000;
export const DEFAULT_MIN_DURATION = 3600;
export const DEFAULT_MAX_DURATION = 2592000;

export function validatePrintableString(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return false;
    }
  }
  return true;
}

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateTitle(title: string): ValidationResult {
  if (!title || title.trim() === '') {
    return { valid: false, error: 'Title is required' };
  }
  if (title.length > MAX_TITLE_LEN) {
    return { valid: false, error: `Title must be ${MAX_TITLE_LEN} characters or less` };
  }
  if (!validatePrintableString(title)) {
    return { valid: false, error: 'Title contains invalid characters' };
  }
  return { valid: true, error: null };
}

export function validateDescription(description: string): ValidationResult {
  if (!description || description.trim() === '') {
    return { valid: false, error: 'Description is required' };
  }
  if (description.length > MAX_DESC_LEN) {
    return { valid: false, error: `Description must be ${MAX_DESC_LEN} characters or less` };
  }
  if (!validatePrintableString(description)) {
    return { valid: false, error: 'Description contains invalid characters' };
  }
  return { valid: true, error: null };
}

export function validateQuorum(quorum: string, totalSupply?: number): ValidationResult {
  if (!quorum || quorum.trim() === '') {
    return { valid: false, error: 'Quorum is required' };
  }
  const quorumNum = Number(quorum);
  if (isNaN(quorumNum) || quorumNum <= 0) {
    return { valid: false, error: 'Quorum must be a positive number' };
  }
  if (totalSupply !== undefined && quorumNum > totalSupply) {
    return { valid: false, error: 'Quorum cannot exceed total token supply' };
  }
  return { valid: true, error: null };
}

export function validateDuration(duration: string, minDuration?: number, maxDuration?: number): ValidationResult {
  if (!duration || duration.trim() === '') {
    return { valid: false, error: 'Duration is required' };
  }
  const durationNum = Number(duration);
  if (isNaN(durationNum) || durationNum <= 0) {
    return { valid: false, error: 'Duration must be a positive number' };
  }
  const min = minDuration ?? DEFAULT_MIN_DURATION;
  const max = maxDuration ?? DEFAULT_MAX_DURATION;
  if (durationNum < min) {
    return { valid: false, error: `Duration must be at least ${min} seconds (${formatDuration(min)})` };
  }
  if (durationNum > max) {
    return { valid: false, error: `Duration must be at most ${max} seconds (${formatDuration(max)})` };
  }
  return { valid: true, error: null };
}

export function validateVote(choice: string | null): ValidationResult {
  if (!choice) {
    return { valid: false, error: 'Please select a vote option' };
  }
  if (choice !== 'For' && choice !== 'Against' && choice !== 'Abstain') {
    return { valid: false, error: 'Invalid vote choice' };
  }
  return { valid: true, error: null };
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(', ') : `${seconds} seconds`;
}