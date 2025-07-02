const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/userSchema')
const env = require('dotenv').config()
const { generateReferralCode } = require('../controller/user/userController')


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id })
            if (user) {
                return done(null, user)
            } else {
                 let referralCode;
            let isUnique = false;
            while (!isUnique) {
                referralCode = generateReferralCode(8);
                const existing = await User.findOne({ referralCode });
                if (!existing) isUnique = true;
            }

            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                image: profile.photos?.[0]?.value || null,
                referralCode: referralCode,
                isAdmin: false,
                isBlocked: false,
                redeemed: false,
            });

            await user.save();

            return done(null, user);
        }
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;