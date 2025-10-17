const express = require('express');
const app = express();

app.post('/api/assignments/create', (req, res) => res.json({ test: 'OK' }));