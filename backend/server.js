require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

const db = require('./db/localDb');
db.initialize();

app.use('/api/setup',    require('./routes/setup'));
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/branding', require('./routes/branding'));
app.use('/api/vacation', require('./routes/vacation'));
app.use('/api/push',    require('./routes/push').router);
app.use('/api/upload',   require('./routes/upload'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Powerbird Backend running on port ${PORT}`));
