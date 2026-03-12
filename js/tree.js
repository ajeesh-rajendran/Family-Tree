/* ============================================
   tree.js — Family Tree Data Model & Persistence
   ============================================ */

const FamilyTree = (() => {
  const STORAGE_KEY = 'familyTreeData';

  // --- Utility ---
  function generateId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  // --- Persistence ---
  function loadTree() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Failed to parse tree data:', e);
      }
    }
    // Seed default sample data
    const sample = createSampleData();
    saveTree(sample);
    return sample;
  }

  function saveTree(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // --- CRUD Operations ---
  function getTree() {
    return loadTree();
  }

  function getPerson(id) {
    const data = loadTree();
    return data.persons[id] || null;
  }

  function addPerson(person) {
    const data = loadTree();
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

    data.persons[id] = newPerson;

    // Add to parent's children array
    if (newPerson.parentId && data.persons[newPerson.parentId]) {
      data.persons[newPerson.parentId].children.push(id);
    }

    // If no root, set as root
    if (!data.rootId) {
      data.rootId = id;
    }

    saveTree(data);
    return newPerson;
  }

  function updatePerson(id, updates) {
    const data = loadTree();
    if (!data.persons[id]) return null;

    Object.assign(data.persons[id], updates);
    // Don't allow changing id or children through updates
    data.persons[id].id = id;

    saveTree(data);
    return data.persons[id];
  }

  function addParent(childId, personMap) {
    const data = loadTree();
    const child = data.persons[childId];
    if (!child) return null;

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
      parentId: child.parentId || null,
      children: [childId],
    };

    data.persons[id] = newPerson;

    // Handle old parent link
    if (child.parentId && data.persons[child.parentId]) {
      const oldParent = data.persons[child.parentId];
      oldParent.children = oldParent.children.filter(cid => cid !== childId);
      oldParent.children.push(id);
    } else {
      // If child had no parent, it was likely the root
      if (data.rootId === childId) {
        data.rootId = id;
      }
    }

    // Update child's parent link
    child.parentId = id;

    saveTree(data);
    return newPerson;
  }

  function deletePerson(id) {
    const data = loadTree();
    if (!data.persons[id]) return false;

    const person = data.persons[id];

    // Recursively delete all descendants
    function deleteDescendants(personId) {
      const p = data.persons[personId];
      if (!p) return;
      if (p.children && p.children.length > 0) {
        [...p.children].forEach(childId => deleteDescendants(childId));
      }
      delete data.persons[personId];
    }

    deleteDescendants(id);

    // Remove from parent's children list
    if (person.parentId && data.persons[person.parentId]) {
      const parent = data.persons[person.parentId];
      parent.children = parent.children.filter(cid => cid !== id);
    }

    // If deleted root, clear rootId
    if (data.rootId === id) {
      data.rootId = null;
    }

    saveTree(data);
    return true;
  }

  function getRootId() {
    return loadTree().rootId;
  }

  function getGenerationCount(personId, data) {
    if (!data) data = loadTree();
    const person = data.persons[personId];
    if (!person || !person.children || person.children.length === 0) return 1;
    let maxChild = 0;
    person.children.forEach(cid => {
      const depth = getGenerationCount(cid, data);
      if (depth > maxChild) maxChild = depth;
    });
    return 1 + maxChild;
  }

  function getTotalPersons() {
    const data = loadTree();
    return Object.keys(data.persons).length;
  }

  // --- Sample Data ---
  function createSampleData() {
    const ids = {
      gf: 'sample_gf',
      f: 'sample_f',
      uncle: 'sample_uncle',
      me: 'sample_me',
      sister: 'sample_sister',
      cousin1: 'sample_cousin1',
    };

    return {
      rootId: ids.gf,
      persons: {
        [ids.gf]: {
          id: ids.gf,
          name: 'Raghunath Sharma',
          mobile: '',
          address: 'Old Delhi, India',
          isLate: true,
          spouseName: 'Kamala Devi',
          spouseMobile: '',
          spouseIsLate: true,
          parentId: null,
          children: [ids.f, ids.uncle],
        },
        [ids.f]: {
          id: ids.f,
          name: 'Ramesh Sharma',
          mobile: '+91 98765 43210',
          address: '12 MG Road, New Delhi',
          isLate: false,
          spouseName: 'Sunita Sharma',
          spouseMobile: '+91 98765 11111',
          spouseIsLate: false,
          parentId: ids.gf,
          children: [ids.me, ids.sister],
        },
        [ids.uncle]: {
          id: ids.uncle,
          name: 'Suresh Sharma',
          mobile: '+91 91234 56789',
          address: '45 Park Avenue, Mumbai',
          isLate: false,
          spouseName: 'Priya Sharma',
          spouseMobile: '+91 91234 22222',
          spouseIsLate: false,
          parentId: ids.gf,
          children: [ids.cousin1],
        },
        [ids.me]: {
          id: ids.me,
          name: 'Arjun Sharma',
          mobile: '+91 99887 76655',
          address: '101 Tech Park, Bangalore',
          isLate: false,
          spouseName: '',
          spouseMobile: '',
          spouseIsLate: false,
          parentId: ids.f,
          children: [],
        },
        [ids.sister]: {
          id: ids.sister,
          name: 'Meera Sharma',
          mobile: '+91 99001 12233',
          address: '56 Lake View, Hyderabad',
          isLate: false,
          spouseName: '',
          spouseMobile: '',
          spouseIsLate: false,
          parentId: ids.f,
          children: [],
        },
        [ids.cousin1]: {
          id: ids.cousin1,
          name: 'Vikram Sharma',
          mobile: '+91 88776 65544',
          address: '78 Sea Face, Mumbai',
          isLate: false,
          spouseName: '',
          spouseMobile: '',
          spouseIsLate: false,
          parentId: ids.uncle,
          children: [],
        },
      },
    };
  }

  function clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    getTree,
    getPerson,
    addPerson,
    addParent,
    updatePerson,
    deletePerson,
    getRootId,
    getGenerationCount,
    getTotalPersons,
    clearAllData,
    generateId,
  };
})();
