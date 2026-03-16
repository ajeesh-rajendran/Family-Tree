/* ============================================
   tree.js — Family Tree Data API Client
   ============================================ */

const FamilyTree = (() => {
  let cachedTree = { persons: {}, rootId: null };

  // --- API Fetchers ---
  async function loadTree() {
    try {
      const res = await fetch('/api/tree');
      if (res.ok) {
        cachedTree = await res.json();
      }
    } catch (e) {
      console.error('Failed to load tree from DB:', e);
    }
    return cachedTree;
  }

  // --- Synchronous Getters (relying on cache) ---
  function getTree() {
    return cachedTree;
  }

  function getPerson(id) {
    return cachedTree.persons[id] || null;
  }

  function getRootId() {
    return cachedTree.rootId;
  }

  function getTotalPersons() {
    return Object.keys(cachedTree.persons).length;
  }

  function getGenerationCount(personId, data, currentDepth = 1) {
    const person = data.persons[personId];
    if (!person || !person.children || person.children.length === 0) {
      return currentDepth;
    }
    let maxDepth = currentDepth;
    for (const childId of person.children) {
      const depth = getGenerationCount(childId, data, currentDepth + 1);
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }

  // --- Async Mutations ---

  // Generate ID locally for optimisic updates or sending to server
  function generateId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  async function addPerson(person) {
    const id = generateId();
    const newPerson = {
      id,
      name: person.name || 'New Person',
      mobile: person.mobile || '',
      address: person.address || '',
      isLate: person.isLate || false,
      spouseName: person.spouseName || '',
      spouseMobile: person.spouseMobile || '',
      spouseIsLate: person.spouseIsLate || false,
      parentId: person.parentId || null,
      children: [],
    };

    try {
      await fetch('/api/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPerson)
      });
      // Optionally reload from server to ensure sync
      await loadTree();
      return newPerson;
    } catch (e) {
      console.error('Add failed', e);
      return null;
    }
  }

  async function addParent(childId, personMap) {
    const id = generateId();
    const newPerson = {
      id,
      name: personMap.name || 'New Person',
      mobile: personMap.mobile || '',
      address: personMap.address || '',
      isLate: personMap.isLate || false,
      spouseName: personMap.spouseName || '',
      spouseMobile: personMap.spouseMobile || '',
      spouseIsLate: personMap.spouseIsLate || false,
    };

    try {
      await fetch('/api/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, parentData: newPerson })
      });
      await loadTree();
      return newPerson;
    } catch (e) {
      console.error('Add parent failed', e);
      return null;
    }
  }

  async function updatePerson(id, updates) {
    try {
      await fetch(`/api/person/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      await loadTree();
      return true;
    } catch (e) {
      console.error('Update failed', e);
      return false;
    }
  }

  async function deletePerson(id) {
    try {
      await fetch(`/api/person/${id}`, {
        method: 'DELETE'
      });
      await loadTree();
      return true;
    } catch (e) {
      console.error('Delete failed', e);
      return false;
    }
  }

  return {
    loadTree, // Need to call this on init
    getTree,
    getPerson,
    addPerson,
    addParent,
    updatePerson,
    deletePerson,
    getRootId,
    getGenerationCount,
    getTotalPersons,
    generateId,
  };
})();
