/* ============================================
   app.js — Main Application Controller
   ============================================ */

const App = (() => {
  function init() {
    Modal.init();
    updateMode();
    renderTree();

    // Toolbar buttons
    document.getElementById('btnAddRoot').addEventListener('click', () => {
      if (!Auth.isAdmin()) return;
      Modal.openAddChild(null);
    });

    document.getElementById('btnExpandAll').addEventListener('click', () => {
      document.querySelectorAll('.tree-children.collapsed').forEach(el => {
        el.classList.remove('collapsed');
      });
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.textContent = '−';
        btn.title = 'Collapse';
      });
    });

    document.getElementById('btnCollapseAll').addEventListener('click', () => {
      document.querySelectorAll('.tree-children').forEach(el => {
        el.classList.add('collapsed');
      });
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.textContent = '+';
        btn.title = 'Expand';
      });
    });

    document.getElementById('btnLogin').addEventListener('click', () => {
      if (Auth.isAdmin()) {
        Auth.logout();
        showToast('Logged out', 'info');
        updateMode();
        renderTree();
      } else {
        Modal.openLogin();
      }
    });
  }

  function updateMode() {
    const admin = Auth.isAdmin();
    const badge = document.getElementById('modeBadge');
    const loginBtn = document.getElementById('btnLogin');
    const addRootBtn = document.getElementById('btnAddRoot');

    if (admin) {
      badge.className = 'mode-badge admin';
      badge.innerHTML = '🔓 Admin Mode';
      loginBtn.innerHTML = '🚪 Logout';
      loginBtn.className = 'btn btn-secondary';
      addRootBtn.style.display = '';
    } else {
      badge.className = 'mode-badge read-only';
      badge.innerHTML = '👁 Read Only';
      loginBtn.innerHTML = '🔐 Admin Login';
      loginBtn.className = 'btn btn-primary';
      addRootBtn.style.display = 'none';
    }

    // Update stats
    const totalPersons = FamilyTree.getTotalPersons();
    const rootId = FamilyTree.getRootId();
    const data = FamilyTree.getTree();
    const generations = rootId ? FamilyTree.getGenerationCount(rootId, data) : 0;
    document.getElementById('statsInfo').textContent = `${totalPersons} members · ${generations} generation${generations !== 1 ? 's' : ''}`;
  }

  function renderTree() {
    const container = document.getElementById('treeContainer');
    const data = FamilyTree.getTree();
    const rootId = data.rootId;

    container.innerHTML = '';

    if (!rootId || !data.persons[rootId]) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌳</div>
          <h2>No Family Tree Yet</h2>
          <p>Login as admin and click "Add Root Person" to start building your family tree.</p>
        </div>
      `;
      updateMode();
      return;
    }

    const treeEl = buildPersonNode(rootId, data);
    container.appendChild(treeEl);
    updateMode();
  }

  function buildPersonNode(personId, data) {
    const person = data.persons[personId];
    if (!person) return document.createDocumentFragment();

    const group = document.createElement('div');
    group.className = 'tree-node-group';

    // Person card
    const card = document.createElement('div');
    card.className = 'person-card' + (person.isLate ? ' late' : '');
    card.addEventListener('click', (e) => {
      if (e.target.closest('.admin-actions')) return;
      if (e.target.closest('.toggle-btn')) return;
      Modal.open(personId);
    });

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'person-avatar';
    const initials = person.name.split(' ').map(w => w[0]).join('').substr(0, 2);
    avatar.textContent = initials;
    card.appendChild(avatar);

    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'person-name';
    nameEl.textContent = person.name;
    card.appendChild(nameEl);

    // Spouse tag
    if (person.spouseName) {
      const spouseTag = document.createElement('div');
      spouseTag.className = 'spouse-tag' + (person.spouseIsLate ? ' spouse-late' : '');
      spouseTag.innerHTML = person.spouseIsLate
        ? `✝ ${person.spouseName}`
        : `💑 ${person.spouseName}`;
      card.appendChild(spouseTag);
    }

    // Subtitle (generation hint)
    const subtitle = document.createElement('div');
    subtitle.className = 'person-subtitle';
    if (person.isLate) {
      subtitle.textContent = 'Late';
    } else if (person.mobile) {
      subtitle.textContent = person.mobile;
    }
    card.appendChild(subtitle);

    // Admin actions
    if (Auth.isAdmin()) {
      const actions = document.createElement('div');
      actions.className = 'admin-actions';

      if (!person.parentId) {
        const addParentBtn = document.createElement('button');
        addParentBtn.className = 'btn btn-ghost';
        addParentBtn.textContent = '+ Parent';
        addParentBtn.title = 'Add Parent';
        addParentBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          Modal.openAddParent(personId);
        });
        actions.appendChild(addParentBtn);
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-ghost';
      addBtn.textContent = '+ Child';
      addBtn.title = 'Add Child';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        Modal.openAddChild(personId);
      });
      actions.appendChild(addBtn);

      card.appendChild(actions);
    }

    group.appendChild(card);

    // Children
    if (person.children && person.children.length > 0) {
      // Toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn btn-icon btn-ghost toggle-btn';
      toggleBtn.textContent = '−';
      toggleBtn.title = 'Collapse';
      toggleBtn.style.margin = '4px auto';
      toggleBtn.style.fontSize = '0.8rem';
      toggleBtn.addEventListener('click', () => {
        const childrenEl = group.querySelector(':scope > .tree-children');
        if (childrenEl) {
          childrenEl.classList.toggle('collapsed');
          toggleBtn.textContent = childrenEl.classList.contains('collapsed') ? '+' : '−';
          toggleBtn.title = childrenEl.classList.contains('collapsed') ? 'Expand' : 'Collapse';
        }
      });
      group.appendChild(toggleBtn);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children' + (person.children.length > 1 ? ' multi' : '');

      person.children.forEach(childId => {
        const childNode = buildPersonNode(childId, data);
        childrenContainer.appendChild(childNode);
      });

      // Calculate spread for connector lines
      requestAnimationFrame(() => {
        if (person.children.length > 1 && childrenContainer.children.length > 1) {
          const first = childrenContainer.children[0];
          const last = childrenContainer.children[childrenContainer.children.length - 1];
          if (first && last) {
            const containerRect = childrenContainer.getBoundingClientRect();
            const firstRect = first.querySelector('.person-card')?.getBoundingClientRect();
            const lastRect = last.querySelector('.person-card')?.getBoundingClientRect();
            if (firstRect && lastRect) {
              const firstCenter = firstRect.left + firstRect.width / 2 - containerRect.left;
              const lastCenter = lastRect.left + lastRect.width / 2 - containerRect.left;
              const containerCenter = containerRect.width / 2;
              const spreadLeft = containerCenter - firstCenter;
              const spreadRight = lastCenter - containerCenter;
              const spread = Math.max(spreadLeft, spreadRight);
              childrenContainer.style.setProperty('--child-spread', `${spread}px`);
            }
          }
        }
      });

      group.appendChild(childrenContainer);
    }

    return group;
  }

  return { init, renderTree, updateMode };
})();

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
