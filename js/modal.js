/* ============================================
   modal.js — Person Detail Modal
   ============================================ */

const Modal = (() => {
  let currentPersonId = null;
  let isAddingChild = false;
  let addingChildParentId = null;
  let isAddingParent = false;
  let addingParentChildId = null;

  function getElements() {
    return {
      overlay: document.getElementById('personModal'),
      title: document.getElementById('modalTitle'),
      nameInput: document.getElementById('personName'),
      mobileInput: document.getElementById('personMobile'),
      addressInput: document.getElementById('personAddress'),
      lateCheckbox: document.getElementById('personLate'),
      spouseInput: document.getElementById('personSpouse'),
      spouseMobileInput: document.getElementById('spouseMobile'),
      spouseLateCheckbox: document.getElementById('spouseLate'),
      saveBtn: document.getElementById('modalSaveBtn'),
      deleteBtn: document.getElementById('modalDeleteBtn'),
      cancelBtn: document.getElementById('modalCancelBtn'),
      closeBtn: document.getElementById('modalCloseBtn'),
      form: document.getElementById('personForm'),
    };
  }

  function init() {
    const els = getElements();

    els.closeBtn.addEventListener('click', close);
    els.cancelBtn.addEventListener('click', close);
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) close();
    });

    els.saveBtn.addEventListener('click', save);
    els.deleteBtn.addEventListener('click', handleDelete);

    // Member late checkbox toggle
    els.lateCheckbox.addEventListener('change', () => {
      toggleMemberLateFields(els.lateCheckbox.checked);
    });

    // Spouse late checkbox toggle
    els.spouseLateCheckbox.addEventListener('change', () => {
      toggleSpouseLateFields(els.spouseLateCheckbox.checked);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
        closeLogin();
      }
    });

    // Login modal
    const loginOverlay = document.getElementById('loginModal');
    const loginCloseBtn = document.getElementById('loginCloseBtn');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginCancelBtn = document.getElementById('loginCancelBtn');
    const loginPasswordInput = document.getElementById('loginPassword');

    loginCloseBtn.addEventListener('click', closeLogin);
    loginCancelBtn.addEventListener('click', closeLogin);
    loginOverlay.addEventListener('click', (e) => {
      if (e.target === loginOverlay) closeLogin();
    });

    loginSubmitBtn.addEventListener('click', handleLogin);
    loginPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  function toggleMemberLateFields(isLate) {
    const els = getElements();
    const admin = Auth.isAdmin();
    els.mobileInput.disabled = isLate || !admin;
    els.addressInput.disabled = isLate || !admin;

    const mobileGroup = document.getElementById('memberMobileGroup');
    if (isLate) {
      mobileGroup.classList.add('greyed-late');
      els.addressInput.parentElement.classList.add('greyed-late');
    } else {
      mobileGroup.classList.remove('greyed-late');
      els.addressInput.parentElement.classList.remove('greyed-late');
    }
  }

  function toggleSpouseLateFields(isLate) {
    const els = getElements();
    const admin = Auth.isAdmin();
    els.spouseMobileInput.disabled = isLate || !admin;

    const spouseMobileGroup = document.getElementById('spouseMobileGroup');
    if (isLate) {
      spouseMobileGroup.classList.add('greyed-late');
    } else {
      spouseMobileGroup.classList.remove('greyed-late');
    }
  }

  function open(personId) {
    isAddingChild = false;
    addingChildParentId = null;
    currentPersonId = personId;
    const person = FamilyTree.getPerson(personId);
    if (!person) return;

    const els = getElements();
    const admin = Auth.isAdmin();

    els.title.textContent = admin ? 'Edit Person' : 'Person Details';
    els.nameInput.value = person.name;
    els.mobileInput.value = person.mobile;
    els.addressInput.value = person.address;
    els.lateCheckbox.checked = person.isLate;
    els.spouseInput.value = person.spouseName || '';
    els.spouseMobileInput.value = person.spouseMobile || '';
    els.spouseLateCheckbox.checked = person.spouseIsLate || false;

    // Set field editability
    els.nameInput.disabled = !admin;
    els.lateCheckbox.disabled = !admin;
    els.spouseInput.disabled = !admin;
    els.spouseLateCheckbox.disabled = !admin;
    els.spouseMobileInput.disabled = !admin;

    toggleMemberLateFields(person.isLate);
    toggleSpouseLateFields(person.spouseIsLate || false);

    // Show/hide admin buttons
    els.saveBtn.style.display = admin ? '' : 'none';
    els.deleteBtn.style.display = admin ? '' : 'none';

    els.overlay.classList.add('active');
    if (admin) els.nameInput.focus();
  }

  function openAddChild(parentId) {
    isAddingChild = true;
    addingChildParentId = parentId;
    currentPersonId = null;

    const els = getElements();

    els.title.textContent = 'Add New Person';
    els.nameInput.value = '';
    els.mobileInput.value = '';
    els.addressInput.value = '';
    els.lateCheckbox.checked = false;
    els.spouseInput.value = '';
    els.spouseMobileInput.value = '';
    els.spouseLateCheckbox.checked = false;

    els.nameInput.disabled = false;
    els.mobileInput.disabled = false;
    els.addressInput.disabled = false;
    els.lateCheckbox.disabled = false;
    els.spouseInput.disabled = false;
    els.spouseMobileInput.disabled = false;
    els.spouseLateCheckbox.disabled = false;
    toggleMemberLateFields(false);
    toggleSpouseLateFields(false);

    els.saveBtn.style.display = '';
    els.deleteBtn.style.display = 'none';

    els.overlay.classList.add('active');
    els.nameInput.focus();
  }

  function openAddParent(childId) {
    isAddingChild = false;
    addingChildParentId = null;
    isAddingParent = true;
    addingParentChildId = childId;
    currentPersonId = null;

    const els = getElements();

    els.title.textContent = 'Add Parent Node';
    els.nameInput.value = '';
    els.mobileInput.value = '';
    els.addressInput.value = '';
    els.lateCheckbox.checked = false;
    els.spouseInput.value = '';
    els.spouseMobileInput.value = '';
    els.spouseLateCheckbox.checked = false;

    els.nameInput.disabled = false;
    els.mobileInput.disabled = false;
    els.addressInput.disabled = false;
    els.lateCheckbox.disabled = false;
    els.spouseInput.disabled = false;
    els.spouseMobileInput.disabled = false;
    els.spouseLateCheckbox.disabled = false;
    toggleMemberLateFields(false);
    toggleSpouseLateFields(false);

    els.saveBtn.style.display = '';
    els.deleteBtn.style.display = 'none';

    els.overlay.classList.add('active');
    els.nameInput.focus();
  }

  function close() {
    const els = getElements();
    els.overlay.classList.remove('active');
    currentPersonId = null;
    isAddingChild = false;
    addingChildParentId = null;
    isAddingParent = false;
    addingParentChildId = null;
  }

  function save() {
    const els = getElements();
    const name = els.nameInput.value.trim();
    if (!name) {
      els.nameInput.style.borderColor = '#ef4444';
      showToast('Name is required', 'error');
      return;
    }
    els.nameInput.style.borderColor = '';

    const updates = {
      name,
      mobile: els.mobileInput.value.trim(),
      address: els.addressInput.value.trim(),
      isLate: els.lateCheckbox.checked,
      spouseName: els.spouseInput.value.trim(),
      spouseMobile: els.spouseMobileInput.value.trim(),
      spouseIsLate: els.spouseLateCheckbox.checked,
    };

    if (isAddingChild) {
      FamilyTree.addPerson({ ...updates, parentId: addingChildParentId });
      showToast('Child person added successfully', 'success');
    } else if (isAddingParent) {
      FamilyTree.addParent(addingParentChildId, updates);
      showToast('Parent person added successfully', 'success');
    } else if (currentPersonId) {
      FamilyTree.updatePerson(currentPersonId, updates);
      showToast('Changes saved', 'success');
    }

    close();
    App.renderTree();
  }

  function handleDelete() {
    if (!currentPersonId) return;
    const person = FamilyTree.getPerson(currentPersonId);
    if (!person) return;

    const childCount = person.children ? person.children.length : 0;
    let msg = `Delete "${person.name}"?`;
    if (childCount > 0) {
      msg += ` This will also delete all ${childCount} descendant(s).`;
    }

    if (confirm(msg)) {
      FamilyTree.deletePerson(currentPersonId);
      showToast('Person deleted', 'info');
      close();
      App.renderTree();
    }
  }

  // --- Login Modal ---
  function openLogin() {
    const overlay = document.getElementById('loginModal');
    const input = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');
    input.value = '';
    error.classList.remove('show');
    overlay.classList.add('active');
    setTimeout(() => input.focus(), 100);
  }

  function closeLogin() {
    document.getElementById('loginModal').classList.remove('active');
  }

  async function handleLogin() {
    const input = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');
    const password = input.value;

    if (!password) {
      error.textContent = 'Please enter a password';
      error.classList.add('show');
      return;
    }

    const success = await Auth.login(password);
    if (success) {
      closeLogin();
      showToast('Logged in as Admin', 'success');
      App.updateMode();
      App.renderTree();
    } else {
      error.textContent = 'Incorrect password';
      error.classList.add('show');
      input.value = '';
      input.focus();
    }
  }

  return { init, open, openAddChild, openAddParent, close, openLogin, closeLogin };
})();

// --- Toast Helper ---
function showToast(message, type = 'info') {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
