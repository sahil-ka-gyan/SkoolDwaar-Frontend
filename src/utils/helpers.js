/**
 * Format a date string to a readable format
 * @param {string|Date} date
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  if (!date) return '—';
  const d = new Date(date);
  const defaults = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat('en-US', defaults).format(d);
}

/**
 * Format a number as currency
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatINR(amount) {
  if (amount == null) return '—';
  const num = Number(amount);
  if (isNaN(num)) return '—';
  return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

/**
 * Get a greeting based on the current time of day
 * @returns {string}
 */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Get initials from a name string
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Conditionally join class names
 * @param  {...any} classes
 * @returns {string}
 */
export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a large number with K/M suffix
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num == null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Debounce a function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a random ID
 * @returns {string}
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Truncate a string to a maximum length
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateString(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}
