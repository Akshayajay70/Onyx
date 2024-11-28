import express from "express"

const app = express()

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/',(req,res) => {
    res.render('user/login')
})

app.listen(8000)