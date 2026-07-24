const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        const ext = file.originalname.substring(
            file.originalname.lastIndexOf('.')
        );

        const safeName = 'pet_' + Date.now() + ext;
        cb(null, safeName);
    }
});

const upload = multer({ storage });

// Database connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'RP738964$',
//     database: 'C237_users_ca2'
// });
const connection = mysql.createConnection({
    host: 'c237-annie-mysql.mysql.database.azure.com',
    user: 'c237_025',
    password: 'c237025@2026!',
    database: 'c237_025_ca2team1',
    ssl: {
        rejectUnauthorized: true // Azure MySQL requires SSL - this is what fixes the ER_SECURE_TRANSPORT_REQUIRED error
    }
});
connection.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Session Middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Please log in to access this page.');
        res.redirect('/login');
    }
};

const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        req.flash('error', 'Access denied. Admin privileges required.');
        res.redirect('/');
    }
};

// Home Page
app.get('/', (req, res) => {
    res.render('index', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

// Register Page
app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

// Registration Validation Middleware
const validateRegistration = (req, res, next) => {
    const { username, email, password, contact } = req.body;

    if (!username || !email || !password || !contact) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters long.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    next();
};

// Register User
app.post('/register', validateRegistration, (req, res) => {
    const {
        username,
        email,
        password,
        contact,
        role
    } = req.body;

    const sql =
        'INSERT INTO users (username, email, password, contact, role) VALUES (?, ?, SHA1(?), ?, ?)';

    connection.query(
        sql,
        [username, email, password, contact, role],
        (err, result) => {
            if (err) {
                throw err;
            }

            console.log(result);

            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        }
    );
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// Login Process
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql =
        'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';

    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0];

            req.flash('success', 'Login successful!');
            res.redirect('/pets');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});
// User's Dashboard 
app.get('/pets', isLoggedIn, (req, res) => {
    res.render('/pets', {
        user: req.session.user
    });
});

// Admin Dashboard
app.get('/admin', checkAdmin, (req, res) => {
    res.render('admin', {
        user: req.session.user
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }

        res.redirect('/');
    });
});
// ============================================================
// BEDELIA'S PART -- Viewing and Displaying Information
// (basic version included here only so the app runs end-to-end;
//  NOT covered in the journal draft -- ask Bedelia to document it)
// ============================================================

app.get('/pets', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM pets ORDER BY petId DESC';
    connection.query(sql, (err, results) => {
        if (err) {
            throw err;
        }
        res.render('pets', {
            user: req.session.user,
            pets: results,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.get('/pets/:id', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM pets WHERE petId = ?';
    connection.query(sql, [req.params.id], (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            res.render('petDetails', { user: req.session.user, pet: results[0] });
        } else {
            res.status(404).send('Pet not found');
        }
    });
});

// ============================================================
// CAIRBRIEL'S PART -- Searching, Filtering or Organising Information
// ============================================================

app.get('/search', checkAuthenticated, (req, res) => {
    const keyword = req.query.keyword;
    const species = req.query.species;
    const adoptionStatus = req.query.adoptionStatus;

    let sql = 'SELECT * FROM pets WHERE 1 = 1';
    let params = [];

    if (keyword) {
        sql += ' AND (petName LIKE ? OR disabilityType LIKE ? OR description LIKE ?)';
        params.push('%' + keyword + '%', '%' + keyword + '%', '%' + keyword + '%');
    }
    if (species) {
        sql += ' AND species = ?';
        params.push(species);
    }
    if (adoptionStatus) {
        sql += ' AND adoptionStatus = ?';
        params.push(adoptionStatus);
    }
    sql += ' ORDER BY petId DESC';

    connection.query(sql, params, (err, results) => {
        if (err) {
            throw err;
        }
        res.render('search', {
            user: req.session.user,
            pets: results,
            keyword: keyword,
            species: species,
            adoptionStatus: adoptionStatus
        });
    });
});

// ============================================================
// CHARLOTTE'S PART -- Adding New Information to the System
// ============================================================

app.get('/addPet', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addPet', { user: req.session.user });
});

app.post('/addPet', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const { petName, species, breed, age, disabilityType, description, adoptionStatus } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // save uploaded file name
    } else {
        image = ''; // empty string, not null - the image column is NOT NULL
    }

    const sql = 'INSERT INTO pets (petName, species, breed, age, disabilityType, description, adoptionStatus, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [petName, species, breed, age, disabilityType, description, adoptionStatus, image], (err, result) => {
        if (err) {
            throw err;
        }
        req.flash('success', petName + ' was added successfully!');
        res.redirect('/pets');
    });
});

// ============================================================
// GARETH'S PART -- Editing Existing Information
// ============================================================

app.get('/editPet/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const petId = req.params.id;
    const sql = 'SELECT * FROM pets WHERE petId = ?';
    connection.query(sql, [petId], (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            res.render('editPet', { user: req.session.user, pet: results[0] });
        } else {
            res.status(404).send('Pet not found');
        }
    });
});

app.post('/editPet/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const petId = req.params.id;
    const { petName, species, breed, age, disabilityType, description, adoptionStatus, currentImage } = req.body;
    let image = currentImage; // keep existing image by default
    if (req.file) {
        image = req.file.filename; // replace with new uploaded file
    }

    const sql = 'UPDATE pets SET petName = ?, species = ?, breed = ?, age = ?, disabilityType = ?, description = ?, adoptionStatus = ?, image = ? WHERE petId = ?';
    connection.query(sql, [petName, species, breed, age, disabilityType, description, adoptionStatus, image, petId], (err, result) => {
        if (err) {
            throw err;
        }
        req.flash('success', petName + ' was updated successfully!');
        res.redirect('/pets');
    });
});

// ============================================================
// DANIEL'S PART -- Removing Information from the System
// ============================================================

app.get('/deletePet/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const petId = req.params.id;
    const sql = 'DELETE FROM pets WHERE petId = ?';
    connection.query(sql, [petId], (err, result) => {
        if (err) {
            throw err;
        }
        req.flash('success', 'Pet record deleted successfully!');
        res.redirect('/pets');
    });
});

// Start Server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});