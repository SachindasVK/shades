const Banner = require('../../models/bannerSchema')
const path = require('path')
const fs = require('fs')

const getBannerpage = async(req,res)=>{
    try {
        const findBanner = await Banner.find({})
        res.render('banner',{data:findBanner})
    } catch (error) {
        res.redirect('/admin/error')
    }
}




module.exports={
    getBannerpage
}