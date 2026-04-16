/* ===========================
   FormFill Pro — popup.js
   =========================== */

// ─── Profile Definitions ──────────────────────────────────────────────────────

const PROFILE_DEFS = {
  personal: {
    label: 'Personal',
    sections: [
      {
        title: 'Identity',
        fields: [
          { key: 'fullName',      label: 'Full Name',       placeholder: 'John Doe' },
          { key: 'dob',           label: 'Date of Birth',   placeholder: 'DD/MM/YYYY' },
          { key: 'iitStudentId',  label: 'IIT Student ID',  placeholder: 'IIT/2024/001' },
          { key: 'uowStudentId',  label: 'UoW Student ID',  placeholder: 'W1234567' },
        ],
      },
      {
        title: 'Contact',
        fields: [
          { key: 'personalEmail',   label: 'Personal Email',   placeholder: 'you@gmail.com' },
          { key: 'universityEmail', label: 'University Email',  placeholder: 'you@iit.ac.lk' },
          { key: 'phone',           label: 'Phone',             isPhone: true },
          { key: 'address',         label: 'Address',           placeholder: '123 Main St, Colombo' },
        ],
      },
      {
        title: 'Social',
        fields: [
          { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/yourname' },
          { key: 'github',   label: 'GitHub',   placeholder: 'github.com/yourname' },
        ],
      },
    ],
  },

  team: {
    label: 'Team',
    sections: [
      {
        title: 'Identity',
        fields: [
          { key: 'fullName',      label: 'Full Name',       placeholder: "Teammate's full name" },
          { key: 'dob',           label: 'Date of Birth',   placeholder: 'DD/MM/YYYY' },
          { key: 'iitStudentId',  label: 'IIT Student ID',  placeholder: 'IIT/2024/001' },
          { key: 'uowStudentId',  label: 'UoW Student ID',  placeholder: 'W1234567' },
        ],
      },
      {
        title: 'Contact',
        fields: [
          { key: 'personalEmail',   label: 'Personal Email',   placeholder: 'teammate@gmail.com' },
          { key: 'universityEmail', label: 'University Email',  placeholder: 'teammate@iit.ac.lk' },
          { key: 'phone',           label: 'Phone',             isPhone: true },
          { key: 'address',         label: 'Address',           placeholder: "Teammate's address" },
        ],
      },
      {
        title: 'Social',
        fields: [
          { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/teammate' },
          { key: 'github',   label: 'GitHub',   placeholder: 'github.com/teammate' },
        ],
      },
    ],
  },

  company: {
    label: 'Company',
    sections: [
      {
        title: 'Company Info',
        fields: [
          { key: 'companyName', label: 'Company Name', placeholder: 'CorpoVinculo' },
          { key: 'email',       label: 'Email',        placeholder: 'info@corpovinculo.com' },
          { key: 'website',     label: 'Website URL',  placeholder: 'https://corpovinculo.com' },
        ],
      },
      {
        title: 'Social Media',
        fields: [
          { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'linkedin.com/company/corpovinculo' },
          { key: 'youtube',   label: 'YouTube',   placeholder: 'youtube.com/c/corpovinculo' },
          { key: 'facebook',  label: 'Facebook',  placeholder: 'facebook.com/corpovinculo' },
          { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/corpovinculo' },
          { key: 'tiktok',    label: 'TikTok',    placeholder: 'tiktok.com/@corpovinculo' },
        ],
      },
    ],
  },
};

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_PROFILES = {
  personal: {
    fullName: '', dob: '', personalEmail: '', universityEmail: '',
    phoneLocal: '', phoneInternational: '',
    iitStudentId: '', uowStudentId: '', address: '',
    linkedin: '', github: '',
  },
  team: {
    fullName: '', dob: '', personalEmail: '', universityEmail: '',
    phoneLocal: '', phoneInternational: '',
    iitStudentId: '', uowStudentId: '', address: '',
    linkedin: '', github: '',
  },
  company: {
    companyName: '', email: '', website: '',
    youtube: '', linkedin: '', facebook: '', instagram: '', tiktok: '',
  },
};

// ─── State ────────────────────────────────────────────────────────────────────

let profiles    = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
let currentTab  = 'personal';
let isEditing   = false;
let phoneMode   = { personal: 'local', team: 'local' }; // 'local' | 'intl'
let toastTimer  = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const $content    = document.getElementById('profileContent');
const $editBtn    = document.getElementById('editBtn');
const $saveBtn    = document.getElementById('saveBtn');
const $autofill   = document.getElementById('autofillBtn');
const $toast      = document.getElementById('toast');

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.sync.get(['profiles', 'phoneMode']);

  if (stored.profiles) {
    for (const key of Object.keys(DEFAULT_PROFILES)) {
      profiles[key] = { ...DEFAULT_PROFILES[key], ...(stored.profiles[key] || {}) };
    }
  }
  if (stored.phoneMode) {
    phoneMode = { ...phoneMode, ...stored.phoneMode };
  }

  render();
}

async function persist() {
  await chrome.storage.sync.set({ profiles, phoneMode });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  const def  = PROFILE_DEFS[currentTab];
  const data = profiles[currentTab];
  let html   = '';

  for (const section of def.sections) {
    html += `<div class="section">`;
    html += `<div class="section-title">${section.title}</div>`;

    for (const field of section.fields) {
      if (field.isPhone) {
        html += renderPhoneRow(data);
      } else {
        html += renderFieldRow(field, data[field.key] || '');
      }
    }

    html += `</div>`;
  }

  $content.innerHTML = html;
  attachListeners();
}

function renderFieldRow(field, value) {
  const empty   = !value;
  const display = empty ? (field.placeholder || 'Not set') : value;

  if (isEditing) {
    return `
    <div class="field-row" data-key="${field.key}">
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">${field.label}</div>
          <input class="edit-input" type="text"
            value="${esc(value)}"
            placeholder="${esc(field.placeholder || '')}"
            data-key="${field.key}">
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="field-row" data-key="${field.key}">
    <div class="field-inner">
      <div class="field-info">
        <div class="field-label">${field.label}</div>
        <div class="field-value${empty ? ' empty' : ''}" title="${esc(value)}">${esc(display)}</div>
      </div>
      <div class="field-actions">
        <button class="copy-btn" data-copy="${esc(value)}"
          ${empty ? 'disabled' : ''} title="Copy to clipboard">
          ${iconCopy()}
        </button>
      </div>
    </div>
  </div>`;
}

function renderPhoneRow(data) {
  const mode     = phoneMode[currentTab] || 'local';
  const localVal = data.phoneLocal || '';
  const intlVal  = data.phoneInternational || '';
  const active   = mode === 'local' ? localVal : intlVal;
  const empty    = !active;

  if (isEditing) {
    return `
    <div class="field-row phone-edit-pair">
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">Phone (Local)</div>
          <input class="edit-input" type="text"
            value="${esc(localVal)}"
            placeholder="0771234567"
            data-key="phoneLocal">
        </div>
      </div>
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">Phone (International)</div>
          <input class="edit-input" type="text"
            value="${esc(intlVal)}"
            placeholder="+94771234567"
            data-key="phoneInternational">
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="field-row">
    <div class="field-inner">
      <div class="field-info">
        <div class="field-label">Phone</div>
        <div class="field-value${empty ? ' empty' : ''}">${esc(active || (mode === 'local' ? '0771234567' : '+94771234567'))}</div>
      </div>
      <div class="field-actions">
        <div class="phone-toggle">
          <button class="phone-toggle-btn${mode === 'local' ? ' active' : ''}" data-phone-mode="local">Local</button>
          <button class="phone-toggle-btn${mode === 'intl'  ? ' active' : ''}" data-phone-mode="intl">Intl</button>
        </div>
        <button class="copy-btn" data-copy="${esc(active)}"
          ${empty ? 'disabled' : ''} title="Copy to clipboard">
          ${iconCopy()}
        </button>
      </div>
    </div>
  </div>`;
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function attachListeners() {
  // Copy buttons
  $content.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.copy;
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        btn.classList.add('copied');
        btn.innerHTML = iconCheck();
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = iconCopy();
        }, 1500);
      } catch {
        showToast('Copy failed', 'error');
      }
    });
  });

  // Phone toggle buttons
  $content.querySelectorAll('.phone-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      phoneMode[currentTab] = btn.dataset.phoneMode;
      persist();
      render();
    });
  });

  // Edit inputs — live update state
  if (isEditing) {
    $content.querySelectorAll('.edit-input').forEach(input => {
      input.addEventListener('input', () => {
        profiles[currentTab][input.dataset.key] = input.value;
      });
    });
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (isEditing) {
      collectEditValues();
      persist();
      setEditMode(false);
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.profile;
    render();
  });
});

// ─── Edit / Save ──────────────────────────────────────────────────────────────

$editBtn.addEventListener('click', () => {
  setEditMode(!isEditing);
});

$saveBtn.addEventListener('click', async () => {
  collectEditValues();
  await persist();
  setEditMode(false);
  showToast('Profile saved!', 'success');
});

function setEditMode(on) {
  isEditing = on;
  $editBtn.classList.toggle('active', on);
  $editBtn.title = on ? 'Cancel edit' : 'Edit profile';
  $saveBtn.classList.toggle('hidden', !on);
  render();
}

function collectEditValues() {
  $content.querySelectorAll('.edit-input').forEach(input => {
    profiles[currentTab][input.dataset.key] = input.value.trim();
  });
}

// ─── Autofill ─────────────────────────────────────────────────────────────────

$autofill.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { showToast('No active tab', 'error'); return; }

  const payload = {
    action:  'autofill',
    profile: currentTab,
    data:    profiles[currentTab],
  };

  try {
    const res = await chrome.tabs.sendMessage(tab.id, payload);
    showToast(res.message || 'Done!', res.filled > 0 ? 'success' : '');
  } catch {
    // Content script may not be injected yet on this page; inject it first
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const res = await chrome.tabs.sendMessage(tab.id, payload);
      showToast(res.message || 'Done!', res.filled > 0 ? 'success' : '');
    } catch {
      showToast("Can't fill this page", 'error');
    }
  }
});

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.className = `toast${type ? ' ' + type : ''} show`;
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function iconCopy() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;
}

function iconCheck() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();
