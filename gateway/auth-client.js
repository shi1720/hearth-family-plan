import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';

const configNode = document.getElementById('hearth-auth-config');
const message = document.getElementById('auth-message');
const googleButton = document.getElementById('google-signin');
const sampleButton = document.getElementById('sample-signin');
const emailToggle = document.getElementById('email-toggle');
const emailSection = document.getElementById('email-section');
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailSubmit = document.getElementById('email-submit');
const modeButton = document.getElementById('email-mode');
const resetButton = document.getElementById('password-reset');
let creatingAccount = false;
let operation = false;

function show(text, error = false) {
  message.hidden = false;
  message.className = `message${error ? ' error' : ''}`;
  message.setAttribute('role', error ? 'alert' : 'status');
  message.textContent = text;
}
function busy(active, text) {
  operation = active;
  for (const button of [googleButton, sampleButton, emailSubmit, modeButton, resetButton, emailToggle]) button.disabled = active;
  if (active && text) show(text);
}
function friendly(error) {
  const messages = {
    'auth/popup-closed-by-user': 'The Google window was closed. You can try again or choose another way to begin.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow popups for Hearth and try again.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open. Finish it or try again.',
    'auth/unauthorized-domain': 'Google sign-in is not enabled for this address yet. Please try the private sample or return later.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please use another available option.',
    'auth/network-request-failed': 'The sign-in service could not be reached. Check your connection and try again.',
    'auth/invalid-credential': 'The email or password was not accepted. Check the details or reset your password.',
    'auth/wrong-password': 'The email or password was not accepted. Check the details or reset your password.',
    'auth/user-not-found': 'The email or password was not accepted. Check the details or create an account.',
    'auth/email-already-in-use': 'An account already uses this email. Sign in instead or reset its password.',
    'auth/too-many-requests': 'Too many attempts were made. Please wait a little before trying again.',
    'auth/weak-password': 'Choose a stronger password with at least eight characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-disabled': 'This account is unavailable. Use another account or contact the account administrator.',
  };
  return messages[error?.code] || (error?.safeMessage ? error.safeMessage : 'Sign-in could not be completed. Please try again.');
}
function returnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try { const target = new URL(value, location.origin); return target.origin === location.origin && !target.pathname.startsWith('/api/') && target.pathname !== '/sign-in' ? target.pathname + target.search + target.hash : '/'; } catch { return '/'; }
}

async function main() {
  let settings;
  try { settings = JSON.parse(configNode.textContent); if (!settings.firebase?.apiKey || !settings.firebase?.projectId) throw Error('config'); }
  catch { busy(true); show('Secure sign-in is being configured. Please return shortly.', true); return; }
  const destination = returnPath(settings.returnTo);
  const auth = getAuth(initializeApp(settings.firebase));
  try { await setPersistence(auth, inMemoryPersistence); }
  catch { busy(true); show('This browser could not initialise secure sign-in. Try another browser or window.', true); return; }

  async function createSession(user) {
    await user.reload();
    if (!user.isAnonymous && !user.emailVerified) {
      await sendEmailVerification(user, { url: location.origin + '/sign-in' });
      await signOut(auth);
      show('Please verify your email first. A verification link has been sent. After opening it, return here and sign in again.');
      return false;
    }
    const idToken = await user.getIdToken(true);
    const refreshToken = user.refreshToken;
    const response = await fetch('/api/auth/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, refreshToken }), signal: AbortSignal.timeout(25_000) });
    let payload;
    try { payload = await response.json(); } catch { throw { safeMessage: 'The application did not return a valid sign-in response. Please try again.' }; }
    if (!response.ok) throw { safeMessage: payload.error || 'The application could not create a secure session.' };
    await signOut(auth);
    passwordInput.value = '';
    window.location.assign(destination);
    return true;
  }
  async function run(kind) {
    if (operation) return;
    busy(true, kind === 'sample' ? 'Preparing your isolated private sample...' : 'Opening secure sign-in...');
    try {
      const credential = kind === 'google' ? await signInWithPopup(auth, new GoogleAuthProvider()) : await signInAnonymously(auth);
      await createSession(credential.user);
    } catch (error) { show(friendly(error), true); }
    finally { await signOut(auth).catch(() => {}); busy(false); }
  }
  googleButton.addEventListener('click', () => run('google'));
  sampleButton.addEventListener('click', () => run('sample'));
  emailToggle.addEventListener('click', () => { emailSection.hidden = !emailSection.hidden; emailToggle.setAttribute('aria-expanded', String(!emailSection.hidden)); if (!emailSection.hidden) emailInput.focus(); });
  modeButton.addEventListener('click', () => {
    creatingAccount = !creatingAccount;
    emailSubmit.textContent = creatingAccount ? 'Create email account' : 'Sign in with email';
    modeButton.textContent = creatingAccount ? 'I already have an account' : 'Create an email account';
    passwordInput.autocomplete = creatingAccount ? 'new-password' : 'current-password';
    passwordInput.minLength = creatingAccount ? 8 : 1;
    show(creatingAccount ? 'Create an account, verify the email we send, then sign in for your own plan.' : 'Sign in with an existing verified email account.');
  });
  emailForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (operation || !emailForm.reportValidity()) return;
    busy(true, creatingAccount ? 'Creating your account...' : 'Checking your sign-in...');
    try {
      const credential = creatingAccount ? await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value) : await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
      await createSession(credential.user);
    } catch (error) { show(friendly(error), true); }
    finally { await signOut(auth).catch(() => {}); passwordInput.value = ''; busy(false); }
  });
  resetButton.addEventListener('click', async () => {
    if (operation) return;
    if (!emailInput.reportValidity() || !emailInput.value.trim()) { emailInput.focus(); return; }
    busy(true, 'Preparing password reset...');
    try { await sendPasswordResetEmail(auth, emailInput.value.trim(), { url: location.origin + '/sign-in' }); show('If an eligible account uses that address, its password-reset instructions will arrive by email.'); }
    catch (error) { show(friendly(error), true); }
    finally { busy(false); }
  });
  fetch('/api/auth/status', { cache: 'no-store', credentials: 'same-origin' }).then(async response => {
    if (!response.ok) return;
    const status = await response.json();
    if (status.user) {
      const existing = document.getElementById('existing-session');
      document.getElementById('existing-session-text').textContent = status.user.isDemo ? 'Your private sample is ready to continue.' : `You are already signed in as ${status.user.email}.`;
      document.getElementById('continue-link').href = destination;
      existing.hidden = false;
    }
  }).catch(() => {});
}
main().catch(() => { busy(true); show('Secure sign-in could not start. Please refresh the page and try again.', true); });
