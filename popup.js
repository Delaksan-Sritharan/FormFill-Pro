/* ===========================
   FormFill Pro — popup.js
   =========================== */

// ─── Shared Person Field Sections ─────────────────────────────────────────────
// Used by both the Personal tab and each Team member card

const PERSON_SECTIONS = [
  {
    title: 'Identity',
    fields: [
      { key: 'fullName',       label: 'Full Name',       placeholder: 'John Doe' },
      { key: 'nic',            label: 'NIC Number',      placeholder: '200012345678' },
      { key: 'dob',            label: 'Date of Birth',   placeholder: 'DD/MM/YYYY' },
      { key: 'gender',         label: 'Gender',          type: 'select', options: ['', 'Male', 'Female'] },
      { key: 'foodPreference', label: 'Food Preference', type: 'select', options: ['', 'Non-Vegetarian', 'Vegetarian'] },
      { key: 'iitStudentId',   label: 'IIT Student ID',  placeholder: '20240242' },
      { key: 'uowStudentId',   label: 'UoW Student ID',  placeholder: 'W1234567' },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { key: 'personalEmail',   label: 'Personal Email',   placeholder: 'you@gmail.com' },
      { key: 'universityEmail', label: 'University Email', placeholder: 'you@iit.ac.lk' },
      { key: 'phone',           label: 'Phone',            isPhone: true },
      { key: 'address',         label: 'Address',          placeholder: '123 Main St, Colombo' },
    ],
  },
  {
    title: 'Social',
    fields: [
      { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'linkedin.com/in/yourname' },
      { key: 'github',    label: 'GitHub',    placeholder: 'github.com/yourname' },
      { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/yourname' },
      { key: 'tiktok',    label: 'TikTok',    placeholder: 'tiktok.com/@yourname' },
      { key: 'youtube',   label: 'YouTube',   placeholder: 'youtube.com/@yourname' },
    ],
  },
];

const COMPANY_SECTIONS = [
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
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultPerson() {
  return {
    fullName: '', nic: '', dob: '', gender: '', foodPreference: '',
    personalEmail: '', universityEmail: '',
    phoneLocal: '', phoneInternational: '',
    iitStudentId: '', uowStudentId: '',
    address: '', linkedin: '', github: '',
    instagram: '', tiktok: '', youtube: '',
  };
}

function defaultCompany() {
  return {
    companyName: '', email: '', website: '',
    linkedin: '', youtube: '', facebook: '', instagram: '', tiktok: '',
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

let profiles = {
  personal: defaultPerson(),
  team:     [defaultPerson()],   // array of member objects
  company:  defaultCompany(),
};

let currentTab     = 'personal';
let isEditing      = false;        // personal / company tab edit mode
let editingMember  = null;         // team: index of member being edited (null = none)
let expandedMembers = new Set([0]); // team: set of expanded card indices

// Phone mode per context
// personal: 'local'|'intl'
// team:     { memberIndex: 'local'|'intl' }
let phoneMode = { personal: 'local', team: {} };

let toastTimer = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const $content  = document.getElementById('profileContent');
const $editBtn  = document.getElementById('editBtn');
const $saveBtn  = document.getElementById('saveBtn');
const $autofill = document.getElementById('autofillBtn');
const $toast    = document.getElementById('toast');

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.sync.get(['profiles', 'phoneMode']);

  if (stored.profiles) {
    const sp = stored.profiles;

    if (sp.personal) {
      profiles.personal = { ...defaultPerson(), ...sp.personal };
    }

    // Migrate old single-object team format → array
    if (Array.isArray(sp.team)) {
      profiles.team = sp.team.map(m => ({ ...defaultPerson(), ...m }));
      if (profiles.team.length === 0) profiles.team = [defaultPerson()];
    } else if (sp.team && typeof sp.team === 'object') {
      profiles.team = [{ ...defaultPerson(), ...sp.team }];
    }

    if (sp.company) {
      profiles.company = { ...defaultCompany(), ...sp.company };
    }
  }

  if (stored.phoneMode) {
    phoneMode = { personal: 'local', team: {}, ...stored.phoneMode };
    if (!phoneMode.team || typeof phoneMode.team !== 'object') phoneMode.team = {};
  }

  render();
}

async function persist() {
  await chrome.storage.sync.set({ profiles, phoneMode });
}

// ─── Top-level Render ─────────────────────────────────────────────────────────

function render() {
  const onTeam = currentTab === 'team';

  // Show global edit button only on personal / company tabs
  $editBtn.style.display = onTeam ? 'none' : '';
  $saveBtn.classList.toggle('hidden', !isEditing || onTeam);

  if (onTeam) {
    renderTeamTab();
  } else {
    renderStaticTab();
  }
}

// ─── Personal / Company Tab ───────────────────────────────────────────────────

function renderStaticTab() {
  const sections = currentTab === 'company' ? COMPANY_SECTIONS : PERSON_SECTIONS;
  const data     = profiles[currentTab];
  let html       = '';

  for (const section of sections) {
    html += `<div class="section">`;
    html += `<div class="section-title">${section.title}</div>`;
    for (const field of section.fields) {
      if (field.isPhone) {
        html += renderPhoneRow(data, phoneMode.personal, isEditing, null);
      } else {
        html += renderFieldRow(field, data[field.key] || '', isEditing, null);
      }
    }
    html += `</div>`;
  }

  $content.innerHTML = html;
  attachStaticListeners();
}

function attachStaticListeners() {
  attachCopyListeners();

  // Phone toggle (no data-member attr for personal/company)
  $content.querySelectorAll('.phone-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      phoneMode.personal = btn.dataset.phoneMode;
      persist();
      render();
    });
  });

  if (isEditing) {
    $content.querySelectorAll('.edit-input, .edit-select').forEach(inp => {
      const ev = inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(ev, () => {
        profiles[currentTab][inp.dataset.key] = inp.value;
        // Auto-derive the other phone format
        if (inp.dataset.key === 'phoneLocal') {
          const derived = derivePhone(inp.value, 'intl');
          if (derived !== null) {
            profiles[currentTab].phoneInternational = derived;
            const peer = $content.querySelector('.edit-input[data-key="phoneInternational"]');
            if (peer) peer.value = derived;
          }
        } else if (inp.dataset.key === 'phoneInternational') {
          const derived = derivePhone(inp.value, 'local');
          if (derived !== null) {
            profiles[currentTab].phoneLocal = derived;
            const peer = $content.querySelector('.edit-input[data-key="phoneLocal"]');
            if (peer) peer.value = derived;
          }
        }
      });
    });
  }
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function renderTeamTab() {
  const count = profiles.team.length;
  let html = `
    <div class="team-header">
      <span class="team-count">${count} member${count !== 1 ? 's' : ''}</span>
      <button class="btn-add-member" id="addMemberBtn">
        ${iconPlus()} Add Member
      </button>
    </div>
    <div class="member-list">`;

  profiles.team.forEach((member, idx) => {
    html += renderMemberCard(member, idx);
  });

  html += `</div>`;
  $content.innerHTML = html;
  attachTeamListeners();
}

function renderMemberCard(member, idx) {
  const isExpanded = expandedMembers.has(idx);
  const isEdit     = editingMember === idx;
  const name       = member.fullName || `Member ${idx + 1}`;
  const mode       = phoneMode.team[idx] || 'local';

  return `
  <div class="member-card${isExpanded ? ' expanded' : ''}" data-index="${idx}">
    <div class="member-card-header">
      <div class="member-avatar">${idx + 1}</div>
      <span class="member-name-display">${esc(name)}</span>
      <div class="member-header-actions">
        <button class="member-fill-btn icon-btn" data-index="${idx}" title="Autofill page with this member">
          ${iconFill()}
        </button>
        <button class="member-expand-btn icon-btn${isExpanded ? ' active' : ''}" data-index="${idx}"
          title="${isExpanded ? 'Collapse' : 'Expand'}">
          ${isExpanded ? iconChevronUp() : iconChevronDown()}
        </button>
        ${profiles.team.length > 1 ? `
        <button class="member-delete-btn icon-btn" data-index="${idx}" title="Remove member">
          ${iconTrash()}
        </button>` : ''}
      </div>
    </div>
    ${isExpanded ? renderMemberBody(member, idx, isEdit, mode) : ''}
  </div>`;
}

function renderMemberBody(member, idx, isEdit, mode) {
  let html = `<div class="member-card-body">`;

  for (const section of PERSON_SECTIONS) {
    html += `<div class="section">`;
    html += `<div class="section-title">${section.title}</div>`;
    for (const field of section.fields) {
      if (field.isPhone) {
        html += renderPhoneRow(member, mode, isEdit, idx);
      } else {
        html += renderFieldRow(field, member[field.key] || '', isEdit, idx);
      }
    }
    html += `</div>`;
  }

  html += `<div class="member-card-footer">`;
  if (isEdit) {
    html += `
      <button class="btn-member-save" data-index="${idx}">${iconCheck()} Save</button>
      <button class="btn-member-cancel" data-index="${idx}">Cancel</button>`;
  } else {
    html += `
      <button class="btn-member-edit" data-index="${idx}">${iconEdit()} Edit Member</button>`;
  }
  html += `</div></div>`;
  return html;
}

function attachTeamListeners() {
  // Add member
  document.getElementById('addMemberBtn')?.addEventListener('click', () => {
    profiles.team.push(defaultPerson());
    const newIdx = profiles.team.length - 1;
    expandedMembers.add(newIdx);
    editingMember = newIdx;
    persist();
    render();
    setTimeout(() => {
      const cards = $content.querySelectorAll('.member-card');
      cards[newIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  });

  // Expand / collapse
  $content.querySelectorAll('.member-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.index;
      if (expandedMembers.has(idx)) {
        expandedMembers.delete(idx);
        if (editingMember === idx) editingMember = null;
      } else {
        expandedMembers.add(idx);
      }
      render();
    });
  });

  // Delete member
  $content.querySelectorAll('.member-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.index;
      if (profiles.team.length <= 1) return;
      profiles.team.splice(idx, 1);
      // Shift expanded / editing indices
      expandedMembers = new Set(
        [...expandedMembers]
          .map(i => (i > idx ? i - 1 : i))
          .filter(i => i !== idx && i < profiles.team.length)
      );
      if (editingMember === idx) editingMember = null;
      else if (editingMember !== null && editingMember > idx) editingMember--;
      persist();
      render();
    });
  });

  // Fill page with specific member
  $content.querySelectorAll('.member-fill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.index;
      autofillWith(profiles.team[idx], 'personal', idx + 1);
    });
  });

  // Enter edit mode for a member
  $content.querySelectorAll('.btn-member-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editingMember = +btn.dataset.index;
      render();
    });
  });

  // Save member
  $content.querySelectorAll('.btn-member-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.index;
      collectMemberValues(idx);
      editingMember = null;
      persist();
      render();
      showToast('Member saved!', 'success');
    });
  });

  // Cancel edit
  $content.querySelectorAll('.btn-member-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      editingMember = null;
      render();
    });
  });

  attachCopyListeners();

  // Phone toggle (team members carry data-phone-member attr)
  $content.querySelectorAll('.phone-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mi = btn.dataset.phoneMember;
      if (mi !== undefined) {
        phoneMode.team[+mi] = btn.dataset.phoneMode;
      } else {
        phoneMode.personal = btn.dataset.phoneMode;
      }
      persist();
      render();
    });
  });

  // Live-update state while editing
  if (editingMember !== null) {
    $content.querySelectorAll('.edit-input, .edit-select').forEach(inp => {
      const mi  = inp.dataset.member;
      const key = inp.dataset.key;
      const ev  = inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(ev, () => {
        if (mi !== undefined) {
          profiles.team[+mi][key] = inp.value;
          // Auto-derive the other phone format
          if (key === 'phoneLocal') {
            const derived = derivePhone(inp.value, 'intl');
            if (derived !== null) {
              profiles.team[+mi].phoneInternational = derived;
              const peer = $content.querySelector(`.edit-input[data-key="phoneInternational"][data-member="${mi}"]`);
              if (peer) peer.value = derived;
            }
          } else if (key === 'phoneInternational') {
            const derived = derivePhone(inp.value, 'local');
            if (derived !== null) {
              profiles.team[+mi].phoneLocal = derived;
              const peer = $content.querySelector(`.edit-input[data-key="phoneLocal"][data-member="${mi}"]`);
              if (peer) peer.value = derived;
            }
          }
        }
      });
    });
  }
}

function collectMemberValues(idx) {
  $content
    .querySelectorAll(`.edit-input[data-member="${idx}"], .edit-select[data-member="${idx}"]`)
    .forEach(inp => {
      profiles.team[idx][inp.dataset.key] = inp.value;
    });
}

// ─── Shared Field Renderers ───────────────────────────────────────────────────

/**
 * @param {object} field        – field definition
 * @param {string} value        – current value
 * @param {boolean} editing     – whether in edit mode
 * @param {number|null} memberIdx – team member index (null for personal/company)
 */
function renderFieldRow(field, value, editing, memberIdx) {
  const mAttr  = memberIdx !== null ? `data-member="${memberIdx}"` : '';
  const empty  = !value;
  const display = empty ? (field.placeholder || 'Not set') : value;

  if (editing) {
    if (field.type === 'select') {
      const opts = field.options
        .map(o => `<option value="${esc(o)}" ${value === o ? 'selected' : ''}>${o || '— Select —'}</option>`)
        .join('');
      return `
      <div class="field-row">
        <div class="field-inner editing">
          <div class="field-info">
            <div class="field-label">${field.label}</div>
            <select class="edit-select" data-key="${field.key}" ${mAttr}>${opts}</select>
          </div>
        </div>
      </div>`;
    }

    return `
    <div class="field-row">
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">${field.label}</div>
          <input class="edit-input" type="text"
            value="${esc(value)}"
            placeholder="${esc(field.placeholder || '')}"
            data-key="${field.key}" ${mAttr}>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="field-row">
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

/**
 * @param {object} data         – profile/member data object
 * @param {string} mode         – 'local' | 'intl'
 * @param {boolean} editing     – whether in edit mode
 * @param {number|null} memberIdx – team member index (null = personal/company)
 */
function renderPhoneRow(data, mode, editing, memberIdx) {
  const mAttr     = memberIdx !== null ? `data-member="${memberIdx}"` : '';
  const pmAttr    = memberIdx !== null ? `data-phone-member="${memberIdx}"` : '';
  const localVal  = data.phoneLocal || '';
  const intlVal   = data.phoneInternational || '';
  const active    = mode === 'local' ? localVal : intlVal;
  const empty     = !active;

  if (editing) {
    return `
    <div class="field-row phone-edit-pair">
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">Phone (Local)</div>
          <input class="edit-input" type="text"
            value="${esc(localVal)}" placeholder="0771234567"
            data-key="phoneLocal" ${mAttr}>
        </div>
      </div>
      <div class="field-inner editing">
        <div class="field-info">
          <div class="field-label">Phone (International)</div>
          <input class="edit-input" type="text"
            value="${esc(intlVal)}" placeholder="+94771234567"
            data-key="phoneInternational" ${mAttr}>
        </div>
      </div>
    </div>`;
  }

  return `
  <div class="field-row">
    <div class="field-inner">
      <div class="field-info">
        <div class="field-label">Phone</div>
        <div class="field-value${empty ? ' empty' : ''}">
          ${esc(active || (mode === 'local' ? '0771234567' : '+94771234567'))}
        </div>
      </div>
      <div class="field-actions">
        <div class="phone-toggle">
          <button class="phone-toggle-btn${mode === 'local' ? ' active' : ''}"
            data-phone-mode="local" ${pmAttr}>Local</button>
          <button class="phone-toggle-btn${mode === 'intl' ? ' active' : ''}"
            data-phone-mode="intl" ${pmAttr}>Intl</button>
        </div>
        <button class="copy-btn" data-copy="${esc(active)}"
          ${empty ? 'disabled' : ''} title="Copy to clipboard">
          ${iconCopy()}
        </button>
      </div>
    </div>
  </div>`;
}

// ─── Shared Copy Listener ─────────────────────────────────────────────────────

function attachCopyListeners() {
  $content.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.copy;
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        flashCopy(btn);
      } catch {
        showToast('Copy failed', 'error');
      }
    });
  });
}

function flashCopy(btn) {
  btn.classList.add('copied');
  btn.innerHTML = iconCheck();
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = iconCopy();
  }, 1500);
}

// ─── Tab Switching ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (isEditing) {
      collectStaticEditValues();
      persist();
      setEditMode(false);
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.profile;
    render();
  });
});

// ─── Global Edit / Save (Personal & Company) ─────────────────────────────────

$editBtn.addEventListener('click', () => setEditMode(!isEditing));

$saveBtn.addEventListener('click', async () => {
  collectStaticEditValues();
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

function collectStaticEditValues() {
  $content.querySelectorAll('.edit-input, .edit-select').forEach(inp => {
    profiles[currentTab][inp.dataset.key] = inp.value;
  });
}

// ─── Autofill ─────────────────────────────────────────────────────────────────

$autofill.addEventListener('click', async () => {
  if (currentTab === 'team') {
    // Use first expanded member, fallback to member 0
    const activeIdx = [...expandedMembers][0] ?? 0;
    const member    = profiles.team[Math.min(activeIdx, profiles.team.length - 1)];
    await autofillWith(member, 'personal', activeIdx + 1);
  } else {
    await autofillWith(profiles[currentTab], currentTab);
  }
});

async function autofillWith(data, profileType, memberNumber = null) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { showToast('No active tab', 'error'); return; }

  const payload = { action: 'autofill', profile: profileType, data };

  const handle = res => {
    const suffix = memberNumber !== null ? ` (Member ${memberNumber})` : '';
    showToast(
      res.message ? res.message + suffix : 'Done!',
      res.filled > 0 ? 'success' : ''
    );
  };

  try {
    handle(await chrome.tabs.sendMessage(tab.id, payload));
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      handle(await chrome.tabs.sendMessage(tab.id, payload));
    } catch {
      showToast("Can't fill this page", 'error');
    }
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.className = `toast${type ? ' ' + type : ''} show`;
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function iconCopy() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
}
function iconCheck() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function iconPlus() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}
function iconTrash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
}
function iconFill() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 12 5 19 12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>`;
}
function iconChevronDown() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
}
function iconChevronUp() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
}
function iconEdit() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

// ─── Phone Auto-Derive ────────────────────────────────────────────────────────

/**
 * Given a local number (e.g. "0713071272"), derive the international form ("+94713071272").
 * Given an international number (e.g. "+94 71 307 1272"), derive the local form ("0713071272").
 * Returns null if the input doesn't match a known pattern.
 */
function derivePhone(value, targetFormat) {
  const cleaned = value.replace(/[\s\-().]/g, '');
  if (targetFormat === 'intl') {
    // local → intl: strip leading 0, prepend +94
    if (/^0\d{9}$/.test(cleaned)) return '+94' + cleaned.slice(1);
  } else {
    // intl → local: strip country code, prepend 0
    if (/^\+94\d{9}$/.test(cleaned)) return '0' + cleaned.slice(3);
    if (/^0094\d{9}$/.test(cleaned)) return '0' + cleaned.slice(4);
  }
  return null;
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
