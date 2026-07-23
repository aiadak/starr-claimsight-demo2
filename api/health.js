// GET /api/health — tells the front-end whether the Anthropic key is configured.
// Never returns the key itself.
module.exports = (req, res) => {
  res.status(200).json({
    configured: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
  });
};
