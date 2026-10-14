const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Connexion et creation automatique du fichier BDD SQLite
const db = new sqlite3.Database('./secugest.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Base de donnees SQLite connectee.');
});

// Structuralisation des tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE,
        mdp TEXT,
        nom TEXT,
        prenom TEXT,
        role TEXT,
        classe TEXT,
        doitChangerMdp INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eleveId INTEGER,
        module TEXT,
        note REAL,
        FOREIGN KEY(eleveId) REFERENCES utilisateurs(id)
    )`);

    // Compte Superadmin initialise par defaut
    db.run(`INSERT OR IGNORE INTO utilisateurs (id, login, mdp, nom, prenom, role, classe, doitChangerMdp) 
            VALUES (1, 'admin', 'admin123', 'Directeur', 'Admin', 'admin', 'Administration', 0)`);
});

// Route : Authentification
app.post('/api/login', (req, res) => {
    const { login, mdp } = req.body;
    db.get(`SELECT * FROM utilisateurs WHERE login = ? AND mdp = ?`, [login, mdp], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Identifiants incorrects' });
        res.json(user);
    });
});

// Route : Creation d un compte eleve par l Admin
app.post('/api/eleves', (req, res) => {
    const { login, mdp, nom, prenom, classe } = req.body;
    db.run(`INSERT INTO utilisateurs (login, mdp, nom, prenom, role, classe, doitChangerMdp) VALUES (?, ?, ?, ?, 'eleve', ?, 1)`,
        [login, mdp, nom, prenom, classe],
        function(err) {
            if (err) return res.status(400).json({ error: 'Identifiant deja pris' });
            res.json({ id: this.lastID, message: 'Eleve cree avec succes' });
        }
    );
});

// Route : Premier changement de mot de passe obligatoire
app.post('/api/changer-mdp', (req, res) => {
    const { id, newMdp } = req.body;
    db.run(`UPDATE utilisateurs SET mdp = ?, doitChangerMdp = 0 WHERE id = ?`, [newMdp, id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
        res.json({ success: true });
    });
});

// Route : Obtenir la liste des eleves
app.get('/api/eleves', (req, res) => {
    db.all(`SELECT id, login, nom, prenom, classe, doitChangerMdp FROM utilisateurs WHERE role = 'eleve'`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Route : Insertion d une note
app.post('/api/notes', (req, res) => {
    const { eleveId, module, note } = req.body;
    db.run(`INSERT INTO notes (eleveId, module, note) VALUES (?, ?, ?)`, [eleveId, module, note], function(err) {
        res.json({ id: this.lastID });
    });
});

// Route : Consultation des notes
app.get('/api/notes', (req, res) => {
    db.all(`SELECT notes.id, notes.module, notes.note, notes.eleveId, utilisateurs.nom, utilisateurs.prenom, utilisateurs.classe 
            FROM notes JOIN utilisateurs ON notes.eleveId = utilisateurs.id`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.listen(3000, () => console.log('Serveur actif sur http://localhost:3000'));