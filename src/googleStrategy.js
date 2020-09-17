const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

function extractProfile(profile) {
  let imageUrl = '';
  if (profile.photos && profile.photos.length) {
    imageUrl = profile.photos[0].value;
  }
  return {
    id: profile.id,
    displayName: profile.displayName,
    image: imageUrl,
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CLIENT_CALLBACK_URL,
      accessType: 'offline',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    (accessToken, refreshToken, profile, cb) => {
      return cb(null, extractProfile(profile));
    }
  )
);
