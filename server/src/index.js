const path = require('path');
const express = require('express');
const cors = require('cors');

require('./db'); // ensures schema is created on boot

const projectsRouter = require('./routes/projects');
const locationsRouter = require('./routes/locations');
const contactsRouter = require('./routes/contacts');
const scenesRouter = require('./routes/scenes');
const shotsRouter = require('./routes/shots');
const shootDaysRouter = require('./routes/shootDays');
const scriptsRouter = require('./routes/scripts');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// A full-length screenplay's scenes (synopsis text plus its classified
// script_elements, which largely duplicates that text) can add up to several
// hundred KB for a script import -- well past Express's 100kb default, which
// silently rejected the request before the route handler ever ran.
app.use(express.json({ limit: '15mb' }));

app.use('/api/projects', projectsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/scenes', scenesRouter);
app.use('/api/shots', shotsRouter);
app.use('/api/shoot-days', shootDaysRouter);
app.use('/api/scripts', scriptsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'This request is too large for the server to accept.' });
  }
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Film production tool API listening on port ${PORT}`);
});
