/* ===========================
   FormFill Pro — content.js
   Smart autofill engine
   =========================== */

// Guard against duplicate injection
if (!window.__formfillProLoaded) {
  window.__formfillProLoaded = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'autofill') {
      const result = performAutofill(msg.profile, msg.data);
      sendResponse(result);
    }
    return true; // keep channel open
  });
}

// ─── Main Autofill ────────────────────────────────────────────────────────────

function performAutofill(profile, data) {
  const fields = getFormFields();
  let filled   = 0;

  // First pass: handle DOB with separate day/month/year selects
  if (profile !== 'company' && data.dob) {
    filled += fillDobSeparateFields(fields, data.dob);
  }

  // Second pass: fill all other fields
  for (const el of fields) {
    const ctx = getCtx(el);
    let ok = false;

    if (profile === 'company') {
      ok = fillCompany(el, ctx, data);
    } else {
      ok = fillPersonal(el, ctx, data);
    }

    if (ok) filled++;
  }

  const noun = filled === 1 ? 'field' : 'fields';
  return {
    filled,
    message: filled > 0 ? `Filled ${filled} ${noun}!` : 'No matching fields found on this page.',
  };
}

// ─── Collect Form Fields ──────────────────────────────────────────────────────

function getFormFields() {
  const sel = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
    'input:not([type="reset"]):not([type="file"]):not([type="image"])',
    'textarea',
    'select',
  ].join(', ');

  // Use a Set-like approach to deduplicate
  const allEls = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
    ':not([type="reset"]):not([type="file"]):not([type="image"]):not([type="checkbox"]):not([type="radio"]),' +
    'textarea,select'
  );

  return Array.from(allEls).filter(isVisible);
}

function isVisible(el) {
  if (!el.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
}

// ─── Field Context ────────────────────────────────────────────────────────────

function getCtx(el) {
  const id          = norm(el.id);
  const name        = norm(el.name);
  const placeholder = norm(el.placeholder);
  const ariaLabel   = norm(el.getAttribute('aria-label'));
  const autocomplete= norm(el.getAttribute('autocomplete'));
  const type        = (el.type || '').toLowerCase();
  const labelText   = getLabelText(el);

  // Combined string for fuzzy pattern matching
  const combined = `${id} ${name} ${placeholder} ${ariaLabel} ${labelText} ${autocomplete}`;

  return { id, name, placeholder, ariaLabel, labelText, autocomplete, type, combined, el };
}

function norm(s) {
  return (s || '').toLowerCase().trim();
}

/** Find the human-readable label associated with a form element */
function getLabelText(el) {
  // 1. Explicit <label for="id">
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return norm(lbl.textContent);
  }

  // 2. aria-labelledby (used by Google Forms)
  const lblBy = el.getAttribute('aria-labelledby');
  if (lblBy) {
    const parts = lblBy.split(' ').map(id => {
      const ref = document.getElementById(id);
      return ref ? ref.textContent : '';
    });
    const joined = norm(parts.join(' '));
    if (joined) return joined;
  }

  // 3. Wrapping <label>
  const wrapLabel = el.closest('label');
  if (wrapLabel) return norm(wrapLabel.textContent);

  // 4. Traverse ancestors looking for nearby text nodes / sibling labels
  return getAncestorText(el);
}

/** Walk up ancestors (up to 8 levels) looking for descriptive text siblings */
function getAncestorText(el) {
  let node   = el.parentElement;
  let levels = 0;

  while (node && levels < 8) {
    // Check children of this ancestor that are NOT the input itself
    for (const child of node.children) {
      if (child === el || child.contains(el)) continue;
      const tag = child.tagName.toUpperCase();
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) continue;

      const text = child.textContent.trim();
      if (text.length > 0 && text.length < 200) {
        return norm(text);
      }
    }
    node = node.parentElement;
    levels++;
  }
  return '';
}

// ─── Pattern Matching Helpers ─────────────────────────────────────────────────

function has(ctx, ...patterns) {
  return patterns.some(p => ctx.combined.includes(p));
}

function hasExact(ctx, ...patterns) {
  return patterns.some(p => {
    const re = new RegExp(`\\b${escRe(p)}\\b`);
    return re.test(ctx.combined);
  });
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Field Type Detectors ─────────────────────────────────────────────────────

function isDob(ctx) {
  return has(ctx,
    'date of birth', 'dateofbirth', 'date_of_birth', 'dob',
    'birth date', 'birthdate', 'birth_date', 'birthday', 'born on', 'date of birth'
  ) || (ctx.type === 'date' && has(ctx, 'birth', 'dob', 'born'));
}

function isFullName(ctx) {
  const c = ctx.combined;
  const hasFullKeyword = has(ctx,
    'full name', 'fullname', 'full_name', 'your name',
    'complete name', 'applicant name', 'participant name', 'member name',
    'candidate name', 'registrant name'
  );
  if (hasFullKeyword) return true;

  // Generic "name" field that is NOT first/last/middle/user/company/file
  const hasName = c.includes('name');
  const excluded = ['first', 'last', 'given', 'family', 'sur', 'middle',
                    'initial', 'user', 'file', 'company', 'org', 'nick'];
  if (hasName && !excluded.some(e => c.includes(e))) return true;

  return false;
}

function isFirstName(ctx) {
  return has(ctx,
    'first name', 'firstname', 'first_name', 'given name', 'givenname',
    'given_name', 'forename', 'fname', '(first', 'name (first'
  );
}

function isLastName(ctx) {
  return has(ctx,
    'last name', 'lastname', 'last_name', 'surname', 'family name',
    'familyname', 'family_name', 'second name', 'lname', '(last',
    'name (last', 'family/last'
  );
}

function isMiddleName(ctx) {
  return has(ctx, 'middle name', 'middlename', 'middle_name', 'middle initial');
}

function isUniversityEmail(ctx) {
  return has(ctx,
    'university email', 'uni email', 'institutional email', 'institute email',
    'student email', 'academic email', 'college email', 'school email',
    'iit email', 'uow email', '.ac.', '.edu', 'edu email'
  );
}

function isEmail(ctx) {
  return ctx.type === 'email' ||
    ctx.autocomplete === 'email' ||
    has(ctx, 'email', 'e-mail', 'e mail', 'mail address');
}

function isPhone(ctx) {
  return ctx.type === 'tel' ||
    ctx.autocomplete.startsWith('tel') ||
    has(ctx,
      'phone', 'mobile', 'telephone', 'cell', 'whatsapp',
      'contact number', 'contact no', 'mob no', 'mobile no',
      'phone number', 'phone no', 'ph no', 'ph number', 'ph.no', 'tel no'
    );
}

function isInternationalPhone(ctx) {
  return has(ctx,
    'international', 'country code', '+94', 'with code',
    'intl', 'overseas', 'global phone', 'with country', 'dial code'
  );
}

function isCountryCode(ctx) {
  return has(ctx, 'country code', 'dial code', 'isd code', 'calling code', 'country dial');
}

function isStudentId(ctx) {
  return has(ctx,
    'student id', 'student no', 'student number', 'student_id', 'studentid',
    'reg no', 'registration no', 'registration number', 'roll no', 'index no',
    'matric', 'enrollment no', 'enrolment no', 'admission no', 'index number'
  );
}

function isIITId(ctx) {
  return isStudentId(ctx) && has(ctx, 'iit', 'informatics');
}

function isUOWId(ctx) {
  return isStudentId(ctx) && has(ctx, 'uow', 'wollongong');
}

function isAddress(ctx) {
  return ctx.autocomplete.includes('address') ||
    has(ctx,
      'address', 'street', 'home address', 'permanent address',
      'mailing address', 'postal address', 'residential address',
      'current address', 'house', 'location'
    );
}

function isLinkedIn(ctx) {
  return has(ctx, 'linkedin', 'linked in', 'linked-in');
}

function isGitHub(ctx) {
  return has(ctx, 'github', 'git hub', 'git-hub');
}

function isCompanyName(ctx) {
  return has(ctx,
    'company name', 'company_name', 'organization name', 'organisation name',
    'business name', 'firm name', 'company/org', 'org name',
    'company or organization'
  );
}

function isWebsite(ctx) {
  return ctx.type === 'url' ||
    has(ctx,
      'website', 'web site', 'site url', 'homepage', 'home page',
      'company url', 'company website', 'web url', 'company link'
    );
}

function isYouTube(ctx)   { return has(ctx, 'youtube', 'you tube'); }
function isFacebook(ctx)  { return has(ctx, 'facebook', ' fb '); }
function isInstagram(ctx) { return has(ctx, 'instagram', 'insta', ' ig '); }
function isTikTok(ctx)    { return has(ctx, 'tiktok', 'tik tok', 'tik-tok'); }

// ─── Personal/Team Filler ─────────────────────────────────────────────────────

function fillPersonal(el, ctx, data) {
  // DOB: handled separately for selects; handle text inputs here
  if (isDob(ctx) && el.tagName !== 'SELECT') {
    return fillDob(el, ctx, data.dob);
  }

  if (isMiddleName(ctx)) return false; // skip — no data

  if (isFirstName(ctx)) return setValue(el, splitName(data.fullName).first);
  if (isLastName(ctx))  return setValue(el, splitName(data.fullName).last);
  if (isFullName(ctx))  return setValue(el, data.fullName);

  if (isUniversityEmail(ctx)) return setValue(el, data.universityEmail);
  if (isEmail(ctx))           return setValue(el, data.personalEmail);

  if (isCountryCode(ctx)) return setValue(el, '+94');

  if (isPhone(ctx)) {
    const useIntl = isInternationalPhone(ctx);
    return setValue(el, useIntl ? data.phoneInternational : data.phoneLocal);
  }

  if (isIITId(ctx)) return setValue(el, data.iitStudentId);
  if (isUOWId(ctx)) return setValue(el, data.uowStudentId);
  if (isStudentId(ctx)) return setValue(el, data.iitStudentId || data.uowStudentId);

  if (isAddress(ctx))  return setValue(el, data.address);
  if (isLinkedIn(ctx)) return setValue(el, data.linkedin);
  if (isGitHub(ctx))   return setValue(el, data.github);

  return false;
}

// ─── Company Filler ───────────────────────────────────────────────────────────

function fillCompany(el, ctx, data) {
  if (isCompanyName(ctx)) return setValue(el, data.companyName);
  if (isEmail(ctx))       return setValue(el, data.email);
  if (isWebsite(ctx))     return setValue(el, data.website);
  if (isYouTube(ctx))     return setValue(el, data.youtube);
  if (isLinkedIn(ctx))    return setValue(el, data.linkedin);
  if (isFacebook(ctx))    return setValue(el, data.facebook);
  if (isInstagram(ctx))   return setValue(el, data.instagram);
  if (isTikTok(ctx))      return setValue(el, data.tiktok);
  return false;
}

// ─── DOB Handling ─────────────────────────────────────────────────────────────

/** Parse stored "DD/MM/YYYY" into parts */
function parseDob(dobStr) {
  if (!dobStr) return null;
  const p = dobStr.split('/');
  if (p.length !== 3 || p[2].length !== 4) return null;
  return {
    day:   p[0].padStart(2, '0'),
    month: p[1].padStart(2, '0'),
    year:  p[2],
    dayNum:   parseInt(p[0], 10),
    monthNum: parseInt(p[1], 10),
    yearNum:  parseInt(p[2], 10),
    monthName: ['january','february','march','april','may','june',
                'july','august','september','october','november','december']
               [parseInt(p[1], 10) - 1] || '',
  };
}

function fillDob(el, ctx, dobStr) {
  const d = parseDob(dobStr);
  if (!d) return false;

  // Native date input → always YYYY-MM-DD
  if (el.type === 'date') {
    return setValue(el, `${d.year}-${d.month}-${d.day}`);
  }

  const ph  = ctx.placeholder;
  const lbl = ctx.combined;

  // Detect expected format from placeholder hints
  if (ph.includes('yyyy-mm-dd') || ph.includes('yyyy/mm/dd')) {
    return setValue(el, `${d.year}-${d.month}-${d.day}`);
  }
  if (ph.includes('mm/dd/yyyy') || ph.includes('mm-dd-yyyy') || ph.includes('mm/dd/yy')) {
    return setValue(el, `${d.month}/${d.day}/${d.year}`);
  }
  if (ph.includes('dd-mm-yyyy')) {
    return setValue(el, `${d.day}-${d.month}-${d.year}`);
  }
  if (ph.includes('dd/mm/yyyy') || ph.includes('dd/mm/yy')) {
    return setValue(el, `${d.day}/${d.month}/${d.year}`);
  }
  // Full text format hinted
  if (lbl.includes('full') || ph.includes('month name') || ph.includes('january')) {
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    return setValue(el, `${d.dayNum} ${cap(d.monthName)} ${d.year}`);
  }

  // Default: DD/MM/YYYY
  return setValue(el, `${d.day}/${d.month}/${d.year}`);
}

/**
 * Handle DOB encoded as three separate day/month/year fields.
 * Called before the main field loop so they don't get accidentally filled.
 */
function fillDobSeparateFields(fields, dobStr) {
  const d = parseDob(dobStr);
  if (!d) return 0;

  let filled = 0;

  for (const el of fields) {
    if (el.tagName !== 'SELECT' || el.dataset.ffpFilled) continue;
    const ctx = getCtx(el);
    const opts = Array.from(el.options).map(o => norm(o.text));

    // Month select — options contain month names
    if (opts.some(o => ['january','february','march','jan','feb','mar'].some(m => o.includes(m)))) {
      if (!isDob(ctx) && !has(ctx, 'month')) continue;
      // Try matching by month name first, then by number
      const matched = selectByText(el, d.monthName) || selectByValue(el, d.monthNum.toString()) ||
                      selectByValue(el, d.month);
      if (matched) { el.dataset.ffpFilled = '1'; filled++; }
      continue;
    }

    // Year select — options contain birth years (1900–2015 range)
    if (opts.some(o => /^(19|20)\d{2}$/.test(o))) {
      if (!isDob(ctx) && !has(ctx, 'year')) continue;
      const matched = selectByValue(el, d.year) || selectByText(el, d.year);
      if (matched) { el.dataset.ffpFilled = '1'; filled++; }
      continue;
    }

    // Day select — options are 1–31
    if (opts.some(o => o === '1' || o === '01') && opts.some(o => o === '31')) {
      if (!isDob(ctx) && !has(ctx, 'day')) continue;
      const matched = selectByValue(el, d.dayNum.toString()) ||
                      selectByValue(el, d.day) || selectByText(el, d.dayNum.toString());
      if (matched) { el.dataset.ffpFilled = '1'; filled++; }
    }
  }

  return filled;
}

// ─── Value Setting ────────────────────────────────────────────────────────────

function setValue(el, value) {
  if (!value) return false;
  if (el.dataset.ffpFilled) return false; // skip already-filled DOB select

  if (el.tagName === 'SELECT') {
    return selectByText(el, value) || selectByValue(el, value);
  }

  // Use native setter to work with React/Angular/Vue controlled inputs
  const proto = el.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }

  // Fire events that frameworks listen to
  ['input', 'change', 'keyup', 'blur'].forEach(type => {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  });

  // React synthetic event
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));

  return true;
}

function selectByText(el, text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  for (const opt of el.options) {
    if (norm(opt.text).includes(lower) || lower.includes(norm(opt.text))) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

function selectByValue(el, value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  for (const opt of el.options) {
    if (norm(opt.value) === lower || opt.value === value) {
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

// ─── Name Splitting ───────────────────────────────────────────────────────────

function splitName(fullName) {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  // First word → first name; everything else → last name
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
