import os
import json
import sqlite3
import hashlib
from flask import Flask, request, jsonify, g
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DATABASE = 'family_tree.db'
ADMIN_PASSWORD_HASH = '1f64483aeabfb2591605cf525b682e0fbfa10fcb9d7a26f0e35930218776eedc'  # 'admin123' in SHA-256 for simple check

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        # Create persons table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS persons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mobile TEXT,
                address TEXT,
                isLate BOOLEAN,
                spouseName TEXT,
                spouseMobile TEXT,
                spouseIsLate BOOLEAN,
                parentId TEXT
            )
        ''')
        
        # Create metadata table (for rootId)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        db.commit()

# --- Helpers ---
def row_to_dict(row):
    d = dict(row)
    # Convert integer booleans back to true/false
    d['isLate'] = bool(d['isLate'])
    d['spouseIsLate'] = bool(d['spouseIsLate'])
    return d

def get_all_persons():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM persons')
    rows = cursor.fetchall()
    
    persons_dict = {}
    
    # First pass: load all persons
    for row in rows:
        p = row_to_dict(row)
        p['children'] = []
        persons_dict[p['id']] = p
        
    # Second pass: populate children arrays
    for pid, p in persons_dict.items():
        if p['parentId'] and p['parentId'] in persons_dict:
            persons_dict[p['parentId']]['children'].append(pid)
            
    return persons_dict

def get_root_id():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT value FROM metadata WHERE key = ?', ('rootId',))
    row = cursor.fetchone()
    return row['value'] if row else None

def set_root_id(root_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ('rootId', root_id))
    db.commit()

# --- API Routes ---

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password', '')
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    
    if pwd_hash == ADMIN_PASSWORD_HASH:
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid password"}), 401

@app.route('/api/tree', methods=['GET'])
def get_tree():
    persons = get_all_persons()
    root_id = get_root_id()
    
    # Auto-seed sample data if empty
    if not persons and not root_id:
        seed_sample_data()
        persons = get_all_persons()
        root_id = get_root_id()
        
    return jsonify({
        "persons": persons,
        "rootId": root_id
    })

@app.route('/api/person', methods=['POST'])
def add_person():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    pid = data.get('id')
    parent_id = data.get('parentId')
    
    cursor.execute('''
        INSERT INTO persons (id, name, mobile, address, isLate, spouseName, spouseMobile, spouseIsLate, parentId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        pid,
        data.get('name', ''),
        data.get('mobile', ''),
        data.get('address', ''),
        1 if data.get('isLate') else 0,
        data.get('spouseName', ''),
        data.get('spouseMobile', ''),
        1 if data.get('spouseIsLate') else 0,
        parent_id
    ))
    db.commit()
    
    # If no root exists, set this as root
    if not get_root_id():
        set_root_id(pid)
        
    return jsonify({"success": True})

@app.route('/api/parent', methods=['POST'])
def add_parent():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    child_id = data.get('childId')
    parent_data = data.get('parentData')
    new_parent_id = parent_data.get('id')
    
    # 1. Get current child
    cursor.execute('SELECT parentId FROM persons WHERE id = ?', (child_id,))
    child_row = cursor.fetchone()
    if not child_row:
        return jsonify({"success": False, "error": "Child not found"}), 404
        
    old_parent_id = child_row['parentId']
    
    # 2. Insert new parent
    cursor.execute('''
        INSERT INTO persons (id, name, mobile, address, isLate, spouseName, spouseMobile, spouseIsLate, parentId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        new_parent_id,
        parent_data.get('name', ''),
        parent_data.get('mobile', ''),
        parent_data.get('address', ''),
        1 if parent_data.get('isLate') else 0,
        parent_data.get('spouseName', ''),
        parent_data.get('spouseMobile', ''),
        1 if parent_data.get('spouseIsLate') else 0,
        old_parent_id
    ))
    
    # 3. Update child's parentId to point to the new parent
    cursor.execute('UPDATE persons SET parentId = ? WHERE id = ?', (new_parent_id, child_id))
    
    # 4. If child was root, new parent is now root
    root_id = get_root_id()
    if root_id == child_id:
        set_root_id(new_parent_id)
        
    db.commit()
    return jsonify({"success": True})

@app.route('/api/person/<pid>', methods=['PUT'])
def update_person(pid):
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        UPDATE persons 
        SET name=?, mobile=?, address=?, isLate=?, spouseName=?, spouseMobile=?, spouseIsLate=?
        WHERE id=?
    ''', (
        data.get('name', ''),
        data.get('mobile', ''),
        data.get('address', ''),
        1 if data.get('isLate') else 0,
        data.get('spouseName', ''),
        data.get('spouseMobile', ''),
        1 if data.get('spouseIsLate') else 0,
        pid
    ))
    db.commit()
    return jsonify({"success": True})

@app.route('/api/person/<pid>', methods=['DELETE'])
def delete_person(pid):
    db = get_db()
    cursor = db.cursor()
    
    # Recursive delete helper
    def delete_descendants(person_id):
        cursor.execute('SELECT id FROM persons WHERE parentId = ?', (person_id,))
        children = cursor.fetchall()
        for child in children:
            delete_descendants(child['id'])
        cursor.execute('DELETE FROM persons WHERE id = ?', (person_id,))
        
    delete_descendants(pid)
    
    # Check if we deleted the root
    if get_root_id() == pid:
        cursor.execute('DELETE FROM metadata WHERE key = ?', ('rootId',))
        
    db.commit()
    return jsonify({"success": True})

def seed_sample_data():
    db = get_db()
    cursor = db.cursor()
    
    ids = {
        'gf': 'p_gf1',
        'f': 'p_f1',
        'uncle': 'p_u1',
        'me': 'p_me1',
        'sister': 'p_s1',
        'cousin1': 'p_c1'
    }
    
    persons = [
        (ids['gf'], 'Raghunath Sharma', '', 'Ancestral Home, Kerala', 1, 'Kamala Devi', '', 1, None),
        (ids['f'], 'Ramesh Sharma', '+91 98765 43210', '12 MG Road, New Delhi', 0, 'Sunita Sharma', '+91 98765 11111', 0, ids['gf']),
        (ids['uncle'], 'Suresh Sharma', '+91 91234 56789', '45 Park Avenue, Mumbai', 0, 'Priya Sharma', '+91 91234 22222', 0, ids['gf']),
        (ids['me'], 'Arjun Sharma', '+91 99887 76655', '101 Tech Park, Bangalore', 0, '', '', 0, ids['f']),
        (ids['sister'], 'Meera Sharma', '+91 99001 12233', '56 Lake View, Hyderabad', 0, '', '', 0, ids['f']),
        (ids['cousin1'], 'Vikram Sharma', '+91 88776 65544', '78 Sea Face, Mumbai', 0, '', '', 0, ids['uncle']),
    ]
    
    cursor.executemany('''
        INSERT INTO persons (id, name, mobile, address, isLate, spouseName, spouseMobile, spouseIsLate, parentId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', persons)
    
    cursor.execute("INSERT INTO metadata (key, value) VALUES ('rootId', ?)", (ids['gf'],))
    db.commit()

if __name__ == '__main__':
    init_db()
    app.run(port=5000, debug=True)
