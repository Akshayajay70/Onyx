import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userSchema from '../model/userModel.js';  // Import your user model

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,  // Your Google Client ID
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,  // Your Google Client Secret
    callbackURL: "http://localhost:8000/auth/google/callback"
  },
  async (token, tokenSecret, profile, done) => {
    try {
      // Check if user exists in the database
      let user = await userSchema.findOne({ googleId: profile.id });

      if (!user) {
        // If the user does not exist, create a new user in the database
        user = new userSchema({
          fullName: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,  // Save Google ID
          isVerified: true,  // Mark as verified since this is Google Auth
        });

        await user.save();
      }

      return done(null, user);  // Return the user to the next middleware
    } catch (error) {
      done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await userSchema.findById(id);
  done(null, user);
});
