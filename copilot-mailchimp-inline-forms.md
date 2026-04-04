# Wire Inline Signup Forms to Mailchimp — Copilot Instruction Document

## Overview

All four inline signup forms currently use `mailto:` workarounds. This document specifies how to convert each one to submit directly to the Crawford Coaching Mailchimp audience via AJAX (JSONP), keeping users on the page with a confirmation message.

The dedicated `/subscribe` page (crawford-subscribe.html) uses a standard Mailchimp form POST with `target="_blank"`. The inline forms below use JSONP instead, because a form POST would navigate the user away from the page they're on.

---

## Mailchimp Endpoint Details

**Mailchimp Subscribe URL (JSONP):**
```
https://crawford-coaching.us14.list-manage.com/subscribe/post-json?u=e727034e036e2258448e9a4bb&id=15d939f894&f_id=0009b6e5f0
```

Note: for JSONP submission, use `/subscribe/post-json` (not `/subscribe/post`). Append `&c=callbackName` for the JSONP callback.

**Fields:**
- `EMAIL` — email address (required)
- `FNAME` — first name (required)
- `LNAME` — last name (optional)
- `b_e727034e036e2258448e9a4bb_15d939f894` — honeypot field (must be empty string)
- `tags` — hidden tag value: `40196068`

---

## Shared JavaScript Function

Add this function ONCE per page, in a `<script>` block. It handles the Mailchimp JSONP submission.

```javascript
function submitToMailchimp(formData, onSuccess, onError) {
  var params = new URLSearchParams();
  params.set('EMAIL', formData.email);
  params.set('FNAME', formData.firstName);
  if (formData.lastName) params.set('LNAME', formData.lastName);
  params.set('tags', '40196068');
  params.set('b_e727034e036e2258448e9a4bb_15d939f894', '');

  var url = 'https://crawford-coaching.us14.list-manage.com/subscribe/post-json?u=e727034e036e2258448e9a4bb&id=15d939f894&f_id=0009b6e5f0&c=mcCallback&' + params.toString();

  window.mcCallback = function(response) {
    if (response.result === 'success') {
      onSuccess(response.msg);
    } else {
      onError(response.msg);
    }
    delete window.mcCallback;
    var script = document.getElementById('mc-jsonp');
    if (script) script.remove();
  };

  var script = document.createElement('script');
  script.id = 'mc-jsonp';
  script.src = url;
  document.body.appendChild(script);
}
```

### Why JSONP instead of fetch?

Mailchimp's subscribe endpoint does not support CORS for client-side requests. JSONP is Mailchimp's supported approach for same-page submissions without a backend proxy.

---

## Page-by-Page Changes

---

### 1. Homepage (crawford-homepage.html)

**FIND the form HTML (around line 1178):**
```html
<form class="signup__form" onsubmit="handleSignup(event)">
  <input class="signup__input" type="text" name="name" placeholder="Your name" required>
  <input class="signup__input" type="email" name="email" placeholder="Your email" required>
  <button class="signup__btn" type="submit">Subscribe</button>
</form>
```

**REPLACE WITH:**
```html
<form class="signup__form" onsubmit="handleSignup(event)">
  <input class="signup__input" type="text" name="firstName" placeholder="First name *" required>
  <input class="signup__input" type="text" name="lastName" placeholder="Last name">
  <input class="signup__input" type="email" name="email" placeholder="Your email *" required>
  <button class="signup__btn" type="submit">Subscribe</button>
</form>
```

**FIND the handleSignup function (around line 1191-1211) — the entire `function handleSignup(e) { ... }` block.**

**REPLACE WITH:**
```javascript
function submitToMailchimp(formData, onSuccess, onError) {
  var params = new URLSearchParams();
  params.set('EMAIL', formData.email);
  params.set('FNAME', formData.firstName);
  if (formData.lastName) params.set('LNAME', formData.lastName);
  params.set('tags', '40196068');
  params.set('b_e727034e036e2258448e9a4bb_15d939f894', '');

  var url = 'https://crawford-coaching.us14.list-manage.com/subscribe/post-json?u=e727034e036e2258448e9a4bb&id=15d939f894&f_id=0009b6e5f0&c=mcCallback&' + params.toString();

  window.mcCallback = function(response) {
    if (response.result === 'success') {
      onSuccess(response.msg);
    } else {
      onError(response.msg);
    }
    delete window.mcCallback;
    var script = document.getElementById('mc-jsonp');
    if (script) script.remove();
  };

  var script = document.createElement('script');
  script.id = 'mc-jsonp';
  script.src = url;
  document.body.appendChild(script);
}

function handleSignup(e) {
  e.preventDefault();
  var form = e.target;
  var firstName = form.firstName.value.trim();
  var lastName = form.lastName.value.trim();
  var email = form.email.value.trim();
  if (!firstName || !email) return;

  var btn = form.querySelector('.signup__btn');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  submitToMailchimp(
    { firstName: firstName, lastName: lastName, email: email },
    function() {
      form.style.display = 'none';
      var prefs = form.parentElement.querySelector('.signup__prefs');
      if (prefs) prefs.style.display = 'none';
      var confirm = document.getElementById('signup-confirm');
      confirm.textContent = "Thanks \u2014 you're on the list.";
      confirm.style.display = 'block';
    },
    function(msg) {
      btn.textContent = 'Subscribe';
      btn.disabled = false;
      var clean = msg.replace(/<[^>]*>/g, '');
      alert(clean || 'Something went wrong. Please try again.');
    }
  );
}
```

**CSS NOTE:** The homepage `.signup__form` currently lays out inputs in a row. Adding a third input means checking that the flex layout still works. The existing CSS is:
```css
.signup__form { display: flex; gap: 0; flex: 2; min-width: 280px; }
```
This will distribute the three inputs + button in a row on desktop and stack on mobile (existing mobile CSS handles `flex-direction: column`). This should work as-is, but verify visually. If the row feels too cramped, the surname field can be given `flex: 0.7` to take slightly less space than the first name field.

---

### 2. Contact Page (crawford-contact.html)

**FIND the form HTML (around line 711):**
```html
<form class="signup__form" onsubmit="handleSignup(event)">
  <input class="signup__input" type="text" name="name" placeholder="Your name" required>
  <input class="signup__input" type="email" name="email" placeholder="Your email" required>
  <button class="signup__btn" type="submit">Subscribe</button>
</form>
```

**REPLACE WITH:**
```html
<form class="signup__form" onsubmit="handleSignup(event)">
  <input class="signup__input" type="text" name="firstName" placeholder="First name *" required>
  <input class="signup__input" type="text" name="lastName" placeholder="Last name">
  <input class="signup__input" type="email" name="email" placeholder="Your email *" required>
  <button class="signup__btn" type="submit">Subscribe</button>
</form>
```

**FIND the handleSignup function (around line 724-744) and REPLACE with the same `submitToMailchimp` + `handleSignup` block as the homepage (above).**

Adjust the source page reference in the `handleSignup` if you want to track which page signups came from — but since Mailchimp receives the data directly, page-source tracking would require a Mailchimp merge field or tag. For now, all inline forms submit identically.

---

### 3. WHOLE Page (crawford-whole.html)

**FIND the form HTML (around line 934):**
```html
<form class="capture__form" onsubmit="handleWholeCapture(event)">
  <input type="text" class="capture__input" name="name" placeholder="Your name" required>
  <input type="email" class="capture__input" name="email" placeholder="Your email address" required>
  <button type="submit" class="capture__submit">Send It</button>
</form>
```

**REPLACE WITH:**
```html
<form class="capture__form" onsubmit="handleWholeCapture(event)">
  <input type="text" class="capture__input" name="firstName" placeholder="First name *" required>
  <input type="text" class="capture__input" name="lastName" placeholder="Last name">
  <input type="email" class="capture__input" name="email" placeholder="Your email address *" required>
  <button type="submit" class="capture__submit">Send It</button>
</form>
```

**FIND the handleWholeCapture function (around line 1045-1066) and REPLACE WITH:**
```javascript
function submitToMailchimp(formData, onSuccess, onError) {
  var params = new URLSearchParams();
  params.set('EMAIL', formData.email);
  params.set('FNAME', formData.firstName);
  if (formData.lastName) params.set('LNAME', formData.lastName);
  params.set('tags', '40196068');
  params.set('b_e727034e036e2258448e9a4bb_15d939f894', '');

  var url = 'https://crawford-coaching.us14.list-manage.com/subscribe/post-json?u=e727034e036e2258448e9a4bb&id=15d939f894&f_id=0009b6e5f0&c=mcCallback&' + params.toString();

  window.mcCallback = function(response) {
    if (response.result === 'success') {
      onSuccess(response.msg);
    } else {
      onError(response.msg);
    }
    delete window.mcCallback;
    var script = document.getElementById('mc-jsonp');
    if (script) script.remove();
  };

  var script = document.createElement('script');
  script.id = 'mc-jsonp';
  script.src = url;
  document.body.appendChild(script);
}

function handleWholeCapture(e) {
  e.preventDefault();
  var form = e.target;
  var firstName = form.firstName.value.trim();
  var lastName = form.lastName.value.trim();
  var email = form.email.value.trim();
  if (!firstName || !email) return;

  var btn = form.querySelector('.capture__submit');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  submitToMailchimp(
    { firstName: firstName, lastName: lastName, email: email },
    function() {
      form.style.display = 'none';
      var permissions = form.parentElement.querySelector('.capture__permissions');
      if (permissions) permissions.style.display = 'none';
      var confirm = document.getElementById('outline-confirm');
      if (confirm) {
        confirm.textContent = "Thanks \u2014 check your inbox for the course outline.";
        confirm.style.display = 'block';
      }
    },
    function(msg) {
      btn.textContent = 'Send It';
      btn.disabled = false;
      var clean = msg.replace(/<[^>]*>/g, '');
      alert(clean || 'Something went wrong. Please try again.');
    }
  );
}
```

---

### 4. Writing Page (crawford-writing.html)

**FIND the form HTML (around line 779):**
```html
<form class="subscribe-form" id="writing-subscribe-form" onsubmit="handleWritingSubscribe(event)">
  <input type="text" name="name" placeholder="Your name" required>
  <input type="email" name="email" placeholder="Your email" required>
  <button type="submit">Subscribe</button>
</form>
```

**REPLACE WITH:**
```html
<form class="subscribe-form" id="writing-subscribe-form" onsubmit="handleWritingSubscribe(event)">
  <input type="text" name="firstName" placeholder="First name *" required>
  <input type="text" name="lastName" placeholder="Last name">
  <input type="email" name="email" placeholder="Your email *" required>
  <button type="submit">Subscribe</button>
</form>
```

**FIND the handleWritingSubscribe function (around line 825-840) and REPLACE WITH:**
```javascript
function submitToMailchimp(formData, onSuccess, onError) {
  var params = new URLSearchParams();
  params.set('EMAIL', formData.email);
  params.set('FNAME', formData.firstName);
  if (formData.lastName) params.set('LNAME', formData.lastName);
  params.set('tags', '40196068');
  params.set('b_e727034e036e2258448e9a4bb_15d939f894', '');

  var url = 'https://crawford-coaching.us14.list-manage.com/subscribe/post-json?u=e727034e036e2258448e9a4bb&id=15d939f894&f_id=0009b6e5f0&c=mcCallback&' + params.toString();

  window.mcCallback = function(response) {
    if (response.result === 'success') {
      onSuccess(response.msg);
    } else {
      onError(response.msg);
    }
    delete window.mcCallback;
    var script = document.getElementById('mc-jsonp');
    if (script) script.remove();
  };

  var script = document.createElement('script');
  script.id = 'mc-jsonp';
  script.src = url;
  document.body.appendChild(script);
}

function handleWritingSubscribe(e) {
  e.preventDefault();
  var form = e.target;
  var firstName = form.firstName.value.trim();
  var lastName = form.lastName.value.trim();
  var email = form.email.value.trim();
  if (!firstName || !email) return;

  var btn = form.querySelector('button[type="submit"]');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  submitToMailchimp(
    { firstName: firstName, lastName: lastName, email: email },
    function() {
      form.style.display = 'none';
      var confirm = document.getElementById('writing-subscribe-confirm');
      if (confirm) {
        confirm.textContent = "Thanks \u2014 you're subscribed.";
        confirm.style.display = 'block';
      }
    },
    function(msg) {
      btn.textContent = 'Subscribe';
      btn.disabled = false;
      var clean = msg.replace(/<[^>]*>/g, '');
      alert(clean || 'Something went wrong. Please try again.');
    }
  );
}
```

---

## Also Update: Subscribe Page (crawford-subscribe.html)

The dedicated subscribe page created separately uses a standard Mailchimp form POST. It currently has a `FNAME` field but no last name field.

**FIND (in the form body):**
```html
<div class="form__group">
  <label class="form__label" for="mce-FNAME">First name <span class="required">*</span></label>
  <input class="form__input" type="text" name="FNAME" id="mce-FNAME" required placeholder="Your first name">
</div>

<div class="form__group">
  <label class="form__label" for="mce-EMAIL">Email address <span class="required">*</span></label>
```

**REPLACE WITH:**
```html
<div class="form__group">
  <label class="form__label" for="mce-FNAME">First name <span class="required">*</span></label>
  <input class="form__input" type="text" name="FNAME" id="mce-FNAME" required placeholder="Your first name">
</div>

<div class="form__group">
  <label class="form__label" for="mce-LNAME">Last name</label>
  <input class="form__input" type="text" name="LNAME" id="mce-LNAME" placeholder="Your last name">
</div>

<div class="form__group">
  <label class="form__label" for="mce-EMAIL">Email address <span class="required">*</span></label>
```

---

## Summary of Changes per File

| File | HTML changes | JS changes |
|---|---|---|
| `crawford-homepage.html` | Replace 1 input with 2 (firstName + lastName) | Replace `handleSignup`, add `submitToMailchimp` |
| `crawford-contact.html` | Replace 1 input with 2 (firstName + lastName) | Replace `handleSignup`, add `submitToMailchimp` |
| `crawford-whole.html` | Replace 1 input with 2 (firstName + lastName) | Replace `handleWholeCapture`, add `submitToMailchimp` |
| `crawford-writing.html` | Replace 1 input with 2 (firstName + lastName) | Replace `handleWritingSubscribe`, add `submitToMailchimp` |
| `crawford-subscribe.html` | Add LNAME field between FNAME and EMAIL | No JS changes needed |

## Testing

After implementation, test each form by subscribing with a test email. Verify:
1. The form shows "Sending..." on the button while submitting
2. On success, the form hides and a confirmation message appears
3. The subscriber appears in Mailchimp audience with first name, last name, and email
4. Submitting an already-subscribed email shows an appropriate error (Mailchimp returns this automatically)
5. The honeypot field is not visible to users
