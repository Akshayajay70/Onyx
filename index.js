import express from "express"
import connnectDb from "./connections/connection.js"

const app = express()

app.set('view engine', 'ejs')

app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({extended:false}))
app.use(nocache())
app.use(session({secret:"mySecret", resave:false, saveUninitialized:true, cookie:{ secure:false }}))

app.get('/',(req,res) => {
    res.render('user/login')
})

connnectDb()

app.listen(8000)