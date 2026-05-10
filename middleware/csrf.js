// If using session cookies, add CSRF tokens
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply to state-changing routes
router.post('/transfer', csrfProtection, (req, res) => { 
    res.json({ message: 'Transfer successful' });
});

// Client must send: X-CSRF-Token header or _csrf body parameter.
