const { app } = require('@azure/functions');
const h = require('../handlers');

app.http('save', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  route: 'save',
  handler: (req, ctx) => (req.method === 'PUT' ? h.putSave(req, ctx) : h.getSave(req, ctx))
});
app.http('scores', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'scores',
  handler: (req, ctx) => h.getScores(req, ctx)
});
app.http('score', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'score',
  handler: (req, ctx) => h.putScore(req, ctx)
});
app.http('roles', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'roles',
  handler: (req, ctx) => h.getRoles(req, ctx)
});
