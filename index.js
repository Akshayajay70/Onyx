import express from "express"

const app = express()

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/',(req,res) => {
    res.render('partials/nav')
})

app.listen(8000)