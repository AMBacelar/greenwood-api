const { sign } = require('jsonwebtoken');

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

const createAccessToken = ({ userId }) => {
  return sign({ userId }, accessTokenSecret, { expiresIn: '15m' });
};

const createRefreshToken = ({ userId }) => {
  return sign({ userId }, refreshTokenSecret, { expiresIn: '7d' });
};

module.exports = { createAccessToken, createRefreshToken };
