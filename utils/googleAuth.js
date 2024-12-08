import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:8000/auth/google/callback"
  },
  async (token, tokenSecret, profile, done) => {
    try {
      // Just pass the profile information to the callback
      const userProfile = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value
      };
      
      return done(null, userProfile);
    } catch (error) {
      done(error, null);
    }
  }
));

// Modify serialization to handle profile object
passport.serializeUser((profile, done) => {
  done(null, profile);
});

passport.deserializeUser((profile, done) => {
  done(null, profile);
});

export default passport;
