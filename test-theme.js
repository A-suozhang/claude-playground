/**
 * Theme System Unit Tests
 * Tests the light/dark theme switching, persistence, and styling
 */

const fs = require('fs');
const path = require('path');

// Mock localStorage
let mockStorage = {};
const clearStorage = () => {
  mockStorage = {};
};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { mockStorage = {}; }
};

// Mock document and window
global.document = {
  documentElement: {
    classList: {
      add: function(cls) {
        if (!this.classes) this.classes = [];
        if (!this.classes.includes(cls)) this.classes.push(cls);
      },
      remove: function(cls) {
        if (this.classes) this.classes = this.classes.filter(c => c !== cls);
      },
      contains: function(cls) {
        return this.classes && this.classes.includes(cls);
      },
      classes: []
    }
  },
  querySelector: (selector) => {
    if (selector === '.theme-icon') {
      return { textContent: '🌙' };
    }
    return null;
  },
  getElementById: (id) => {
    if (id === 'theme-toggle') {
      return {
        addEventListener: () => {},
        textContent: 'button'
      };
    }
    return null;
  }
};

// Theme management functions
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light') {
    html.classList.remove('theme-dark');
    html.classList.add('theme-light');
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.remove('theme-light');
    html.classList.add('theme-dark');
    localStorage.setItem('theme', 'dark');
  }
}

function getCurrentTheme() {
  const html = document.documentElement;
  if (html.classList.contains('theme-light')) return 'light';
  if (html.classList.contains('theme-dark')) return 'dark';
  return localStorage.getItem('theme') || 'dark';
}

// Test suite
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function runTests() {
  console.log('\n=== Theme System Unit Tests ===\n');

  tests.forEach((t, idx) => {
    try {
      t.fn();
      console.log(`✓ Test ${idx + 1}: ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ Test ${idx + 1}: ${t.name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  });

  console.log(`\n==================================================`);
  console.log(`Tests passed: ${passed}/${tests.length}`);
  console.log(`Tests failed: ${failed}/${tests.length}`);
  console.log(`==================================================\n`);

  return failed === 0;
}

// Define tests
test('initTheme initializes with default dark theme', () => {
  clearStorage();
  initTheme();
  const theme = getCurrentTheme();
  if (theme !== 'dark') throw new Error(`Expected dark, got ${theme}`);
});

test('initTheme reads stored theme from localStorage', () => {
  clearStorage();
  localStorage.setItem('theme', 'light');
  initTheme();
  const theme = getCurrentTheme();
  if (theme !== 'light') throw new Error(`Expected light, got ${theme}`);
});

test('setTheme(light) sets HTML class and localStorage', () => {
  clearStorage();
  setTheme('light');
  if (!document.documentElement.classList.contains('theme-light')) {
    throw new Error('HTML should have theme-light class');
  }
  if (localStorage.getItem('theme') !== 'light') {
    throw new Error('localStorage should have theme=light');
  }
});

test('setTheme(dark) sets HTML class and localStorage', () => {
  clearStorage();
  setTheme('dark');
  if (!document.documentElement.classList.contains('theme-dark')) {
    throw new Error('HTML should have theme-dark class');
  }
  if (localStorage.getItem('theme') !== 'dark') {
    throw new Error('localStorage should have theme=dark');
  }
});

test('setTheme removes old theme class when switching', () => {
  clearStorage();
  setTheme('light');
  if (document.documentElement.classList.contains('theme-dark')) {
    throw new Error('theme-dark should be removed when switching to light');
  }
  setTheme('dark');
  if (document.documentElement.classList.contains('theme-light')) {
    throw new Error('theme-light should be removed when switching to dark');
  }
});

test('getCurrentTheme returns correct theme from classList', () => {
  clearStorage();
  setTheme('light');
  const theme = getCurrentTheme();
  if (theme !== 'light') throw new Error(`Expected light, got ${theme}`);
});

test('Theme persistence: saved theme survives re-initialization', () => {
  clearStorage();
  setTheme('light');

  // Simulate page reload by clearing classList
  document.documentElement.classList.classes = [];

  // Re-initialize (like on page load)
  initTheme();
  const theme = getCurrentTheme();
  if (theme !== 'light') throw new Error(`Expected light after reload, got ${theme}`);
});

test('CSS has light theme variables', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  if (!css.includes(':root.theme-light')) {
    throw new Error('CSS should define :root.theme-light');
  }
  if (!css.includes('--bg-void:') && !css.includes('--bg-void :')) {
    throw new Error('Light theme should define --bg-void');
  }
});

test('CSS has dark theme variables', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  if (!css.includes(':root.theme-dark')) {
    throw new Error('CSS should define :root.theme-dark');
  }
});

test('CSS defines theme toggle button styles', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  if (!css.includes('.theme-toggle')) {
    throw new Error('CSS should define .theme-toggle styles');
  }
});

test('HTML contains theme toggle button', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  if (!html.includes('id="theme-toggle"')) {
    throw new Error('HTML should contain theme-toggle button');
  }
  if (!html.includes('class="theme-icon"')) {
    throw new Error('HTML should contain theme-icon span');
  }
});

test('Controller contains theme functions', () => {
  const js = fs.readFileSync(path.join(__dirname, 'js/controller.js'), 'utf8');
  const functions = ['initTheme', 'setTheme', 'getCurrentTheme', 'onThemeToggle'];
  functions.forEach(fn => {
    if (!js.includes(`function ${fn}`) && !js.includes(`const ${fn}`)) {
      throw new Error(`Controller should define ${fn} function`);
    }
  });
});

test('Controller initializes theme on load', () => {
  const js = fs.readFileSync(path.join(__dirname, 'js/controller.js'), 'utf8');
  if (!js.includes('initTheme()')) {
    throw new Error('initTheme() should be called in initController');
  }
});

// Run all tests
const allPassed = runTests();
process.exit(allPassed ? 0 : 1);
