import express from 'express'
import { Router } from 'express'
import userSchema from '../model/userModel.js'
import bcrypt from 'bcrypt'

const saltRounds = 10;

const route = Router()

route.get('/signup', (req, res) => {
    res.render('user/signup')
})

route.post('/signup', async (req, res) => {

    const { fullName, email, password } = req.body;

    const mail = await userSchema.findOne({ email })
    if (mail) return res.render('user/signup')

    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const newUser = await userSchema.create({
        fullName,
        email,
        password: hashedPassword,
    })
    res.render('user/login')


})

route.get('/login', (req, res) => {
    res.render('user/login')
})

route.post('/login', async (req,res) => {
    try {
        const { email, password } = req.body
        const user = await userSchema.findOne({ email })
        const isMatch = await bcrypt.compare(password, user.password)
        if (!email || !isMatch) return res.render('user/login')

        req.session.user = true
        res.render('user/home')
    }
    catch (error) {
        console.log("ERROR", error)
        res.render('user/login')
    }
})

route.get('/home', (req,res) => {
    res.render('user/home')
})

export default route
