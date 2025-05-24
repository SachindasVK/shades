const User = require('../../models/userSchema')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')


const logout = async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log('Error destroying session',err)
                return res.redirect('/pageerror')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log('unexpected error during logout',error)
        res.redirect('/admin/error')
    }
}

const error = async (req, res) => {
    try {
        res.render('error', { message: 'An error occurred while processing your request.' });
    } catch (error) {
        console.error('Error rendering the error page:', error);
        res.status(500).send('An error occurred while rendering the error page');
    }
}


const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render('adminLogin',{message:null})
}

const login = async(req,res)=>{
    try {
        const {email,password} = req.body
        const admin = await User.findOne({email,isAdmin:true})

        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password)
            if(passwordMatch){
                req.session.admin=true
                return res.redirect('/admin/dashboard')
            }else{
                return res.render('adminLogin',{ message: 'Invalid email or password' })
            }
        }else{
            return res.render('adminLogin',{ message: 'No admin account found' })
        }
    } catch (error) {
        console.log('login error!',error)
        return res.redirect('/admin/error')
    }
}



const loadDashboard = async(req,res)=>{
    if(req.session.admin){
        try {
            res.render('dashboard',{
                pageTitle:'Dashboard'
            })
        } catch (error) {
            console.log('dashboard error',error)
            res.redirect('/admin/error')
        }
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    error,
    logout
}