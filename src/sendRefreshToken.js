const sendRefreshToken = (res, token) => {
  res.cookie('grnwood-network-refresh', token, {
    httpOnly: true,
    domain: process.env.DOMAIN,
    secure: false,
  });
};

module.exports = { sendRefreshToken };
