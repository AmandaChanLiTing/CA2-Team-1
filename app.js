const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
//const multer = require('multer');

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'C237_users_ca2'
});
db.connect((err) => {
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
const isAdmin = (req, res, next) => {
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
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
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
        address,
        contact,
        role
    } = req.body;

    const sql =
        'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';

    db.query(
        sql,
        [username, email, password, address, contact, role],
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

    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0];

            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// User Dashboard
app.get('/dashboard', isLoggedIn, (req, res) => {
    res.render('dashboard', {
        user: req.session.user
    });
});

// Admin Dashboard
app.get('/admin', isAdmin, (req, res) => {
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

// Start Server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});