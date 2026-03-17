const jwt = require('jsonwebtoken');
const { config } = require('../config');

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signAccessToken, verifyAccessToken };

