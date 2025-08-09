const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const path = require('path');
const fs = require('fs');
const logger = require('../../helpers/logger')

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
        logger.error("error sending email: ",error);
        return false;
    }
};

const securePassword = async (password) => {
    try {
        logger.info(`Password received for hashing: ${password}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    } catch (error) {
        logger.error("Error hashing password: ",error.message);
        throw new Error("Password hashing failed");
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password", { message: "" });
    } catch (error) {
        logger.error("Error in to load forgot password page: ",error.message);
        return res.status(500).render('page-404')
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (!emailSent) {
                return res.render('forgot-password', {
                    message: "Failed to send OTP"
                })
            }
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgototp", {
                    email: email
                });
                logger.info(`Email: ${email}`)
                logger.info(`OTP: ${otp}`);
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
        logger.error("Error in forgotEmailValid: ",error);
        return res.status(500).render('page-404')
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;

        if (enteredOtp === req.session.userOtp) {
            req.session.resetAllowed = true;


            if (req.xhr) {
                return res.json({ success: true, redirectUrl: "/reset-password" });
            }


            return res.redirect("/reset-password");
        } else {

            if (req.xhr) {
                return res.json({ success: false, message: "OTP not matching" });
            }


            return res.render("forgotPass-otp", {
                message: "OTP not matching",
                email: req.session.email
            });
        }
    } catch (error) {
        logger.error("Error in verifyForgotPassOtp: ",error);
        return res.status(500).render('page-404')
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
        logger.error("Error in getResetPassPage: ",error);
        return res.status(500).render('page-404')
    }
};
const resendOtp = async (req, res) => {
    try {

        if (req.body.email) {
            req.session.email = req.body.email;
        }

        const email = req.session.email;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        logger.info(`Resending otp to email: ${email}`);

        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            logger.info(`Resend Otp: ${otp}`);
            return res.status(200).json({ success: true, message: "Resend OTP Successful" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }
    } catch (error) {
        logger.error("Error in resend otp", error.message);
        return res.status(500).render('page-404')
    }
};
const postNewPassword = async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;
        logger.info(`new password:  ${newPassword}, confirm: ${confirmPassword}`);

        const email = req.session.email;
        logger.info(email);

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

        const updateResult = await User.updateOne({ email }, { $set: { password: passwordHash } });
        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "User not found or password not updated." });
        }


        req.session.userOtp = null;
        req.session.email = null;
        req.session.resetAllowed = null;

        return res.json({ success: true, message: "Password updated successfully." });

    } catch (error) {
        logger.error("Error in postNewPassword:",error.message);
        return res.status(500).render('page-404')
    }
};

//user profile page
const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect('/login');
        }


        let defaultAddress = null;
        const addressDoc = await Address.findOne({ userId: userId });

        if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {

            const defaultAddr = addressDoc.address.find(addr => addr.isDefault === true);

            if (defaultAddr) {

                defaultAddress = {
                    fullName: defaultAddr.name,
                    addressLine: `${defaultAddr.flat}, ${defaultAddr.landMark ? defaultAddr.landMark + ', ' : ''}${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.pincode}`,
                    phone: defaultAddr.phone,
                    addressType: defaultAddr.addressType,
                    complete: `${defaultAddr.name}, ${defaultAddr.flat}, ${defaultAddr.landMark ? defaultAddr.landMark + ', ' : ''}${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.pincode}, Phone: ${defaultAddr.phone}`
                };
            } else if (addressDoc.address.length > 0) {

                const firstAddr = addressDoc.address[0];
                defaultAddress = {
                    fullName: firstAddr.name,
                    addressLine: `${firstAddr.flat}, ${firstAddr.landMark ? firstAddr.landMark + ', ' : ''}${firstAddr.city}, ${firstAddr.state} - ${firstAddr.pincode}`,
                    phone: firstAddr.phone,
                    addressType: firstAddr.addressType,
                    complete: `${firstAddr.name}, ${firstAddr.flat}, ${firstAddr.landMark ? firstAddr.landMark + ', ' : ''}${firstAddr.city}, ${firstAddr.state} - ${firstAddr.pincode}, Phone: ${firstAddr.phone}`
                };
            }
        }


        userData.defaultAddress = defaultAddress;

        res.render("profile", {
            user: userData,
            username: userData.name
        });
    } catch (error) {
        logger.error('user profile Error:',error);
        return res.status(500).render('page-404')
    }
};



const editUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }


        for (let key in updates) {
            if (updates[key]) {
                user[key] = updates[key];
            }
        }

        await user.save();


        if (req.session.user === id && updates.name) {
            req.session.userName = user.name;
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: user.name,
            },
        });

    } catch (error) {
        logger.error('Error editing profile:',error.message);
        return res.status(500).render('page-404')
    }
};


const removeProfile = async (req, res) => {
    try {
        const { id } = req.params
        const user = await User.findById(id)

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found!' })
        }

        if (user.image && user.image !== 'default.png') {
            const imagePath = path.join(__dirname, '../../public/uploads/userProfileimages', user.image)
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath)
            }
            user.image = null
            await user.save()

            return res.json({ success: true, message: 'Image removed successfully' });
        }
        return res.status(400).json({ success: false, message: 'No image to remove' });
    } catch (error) {
        logger.error('Error removing profile image: ',error);
        return res.status(500).render('page-404')
    }
}


const uploadProfileImage = async (req, res) => {
    try {
        const userId = req.session.user;
        const image = req.file ? req.file.path : null;

        if (!image) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }


        if (user.image && user.image !== 'default.png') {
            const oldImagePath = path.join(__dirname, '../../public/uploads/userProfileimages', user.image);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        user.image = image;
        await user.save();

        res.json({
            success: true,
            message: 'Profile image uploaded successfully'
        });

    } catch (error) {
        logger.error('Error uploading profile image: ',error.message);
        return res.status(500).render('page-404')
    }
};


const getchangePassword = async (req, res) => {
    try {

        const userId = req.session.user
        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await User.findById(userId);

        if (!userData) {
            return res.redirect('/login');
        }

        res.render("changepassword", {
            user: userData,
            username: userData.name
        });
    } catch (error) {
        logger.error('Get change password error: ',error);
        return res.status(500).render('page-404')
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to change your password.'
            });
        }

        const userId = req.session.user
        if (!userId) {
            return res.redirect('/login');
        }

        logger.info(`Extracted userId: ${userId}`);

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long.'
            });
        }

        const dbUser = await User.findById(userId);
        logger.info(`Database user found: ${dbUser}`);

        if (!dbUser) {
            logger.info(`User not found in database with ID: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'User account not found. Please log in again.'
            });
        }


        if (!dbUser.password) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change password for this account type.'
            });
        }


        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, dbUser.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }


        const isNewPasswordSameAsCurrent = await bcrypt.compare(newPassword, dbUser.password);
        if (isNewPasswordSameAsCurrent) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password.'
            });
        }


        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);


        await User.findByIdAndUpdate(userId, {
            password: hashedNewPassword,
            updatedAt: new Date()
        });

        logger.info(`Password updated successfully for user: ${userId}`);


        return res.json({
            success: true,
            message: 'Password changed successfully.'
        });

    } catch (error) {
        logger.error("Change password error: ", error);
        return res.status(500).render('page-404')
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
    editUserProfile,
    removeProfile,
    uploadProfileImage,
    getchangePassword,
    changePassword,
};