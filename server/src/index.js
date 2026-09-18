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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/scenes', scenesRouter);
app.use('/api/shots', shotsRouter);
app.use('/api/shoot-days', shootDaysRouter);

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
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Film production tool API listening on port ${PORT}`);
});
