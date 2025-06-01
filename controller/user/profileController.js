// Backend controller file - fixed version

const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const path = require('path');
const fs = require('fs');

function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOption = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP : ${otp}</h4><br></b>`,
        };

        const info = await transporter.sendMail(mailOption);
        return true;
    } catch (error) {
        console.error("error sending email", error);
        return false;
    }
};

const securePassword = async (password) => {
   try {
    console.log("Password received for hashing:", password); // ✅ Add this
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.log("Error hashing password:", error); // ✅ Already there
    throw new Error("Password hashing failed");
  }
};

const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password", { message: "" });
    } catch (error) {
        console.error("Error in getForgotPassPage:", error);
        res.redirect("/pageNotFound");
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if(!emailSent){
                return res.render('forgot-password',{
                    message:"Failed to send OTP"
                })
            }
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgototp",{
                    email:email
                });
                console.log('Email:',email)
                console.log("OTP: ", otp);
            } else {
                return res.render("forgot-password", {
                    message: "Failed to send OTP. Please try again"
                });
            }
        } else {
            return res.render("forgot-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        res.render("forgot-password", {
            message: "An error occurred. Please try again."
        });
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        
        if (enteredOtp === req.session.userOtp) {
            req.session.resetAllowed = true;
            
            // For AJAX requests
            if (req.xhr) {
                return res.json({ success: true, redirectUrl: "/reset-password" });
            }
            
            // For form submissions
            return res.redirect("/reset-password");
        } else {
            // For AJAX requests
            if (req.xhr) {
                return res.json({ success: false, message: "OTP not matching" });
            }
            
            // For form submissions
            return res.render("forgotPass-otp", {
                message: "OTP not matching",
                email: req.session.email
            });
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error);
        
        // For AJAX requests
        if (req.xhr) {
            return res.status(500).json({ success: false, message: "An error occurred. Please try again." });
        }
        
        // For form submissions
        res.render("forgototp", {
            message: "An error occurred. Please try again.",
            email: req.session.email
        });
    }
};

const getResetPassPage = async (req, res) => {
    try {
        if (req.session.resetAllowed) {
            res.render("reset-password", { message: "" });
        } else {
            res.redirect("/forgot-password");
        }
    } catch (error) {
        console.error("Error in getResetPassPage:", error);
        res.redirect("/pageNotFound");
    }
};
const resendOtp = async (req, res) => {
  try {
    // Update session email only if email is provided in request
    if (req.body.email) {
      req.session.email = req.body.email;
    }

    const email = req.session.email;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    console.log("Resending otp to email", email);

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend Otp: ", otp);
      return res.status(200).json({ success: true, message: "Resend OTP Successful" });
    } else {
      return res.status(500).json({ success: false, message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error("Error in resend otp", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const postNewPassword = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const { newPassword, confirmPassword } = req.body;
    console.log("new password", newPassword, "confirm:", confirmPassword);

    const email = req.session.email;
    console.log(email);

    if (!req.session.resetAllowed) {
      return res.status(403).json({ success: false, message: "Unauthorized access. Please request password reset again." });
    }

    if (!email) {
      return res.status(440).json({ success: false, message: "Session expired. Please try again." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

   
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    const passwordHash = await securePassword(newPassword);
    console.log('password hashed!', passwordHash);

    const updateResult = await User.updateOne({ email }, { $set: { password: passwordHash } });
    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found or password not updated." });
    }

    // Clear session data
    req.session.userOtp = null;
    req.session.email = null;
    req.session.resetAllowed = null;

    return res.json({ success: true, message: "Password updated successfully." });

  } catch (error) {
    console.error("Error in postNewPassword:", error);
    return res.status(500).json({ success: false, message: "An error occurred. Please try again." });
  }
};

//user profile page
    const userProfile = async (req, res) => {
        try {
            const userId = req.session.user;
            const userData = await User.findById(userId);
            res.render("profile", {
                user: userData,
                username:userData.name
            });
        } catch (error) {
            console.error('Error:', error);
            res.redirect("/pageNotFound");
        }
    };


    //edit user profile 
   const editUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email } = req.body;
        const image = req.file ? req.file.filename : null;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Handle image upload
        if (image) {
            if (user.image && user.image !== 'default.png') {
                const oldImagePath = path.join(__dirname, '../../public/uploads/userProfileimages', user.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            user.image = image;
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;

        await user.save();
        
        // Update session if needed
        if (req.session.user === id) {
            req.session.userName = user.name;
        }

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                image: user.image
            }
        });
        
    } catch (error) {
        console.error('Error editing profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error occurred'
        });
    }
};

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    editUserProfile
};