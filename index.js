import express from "express";
import passport from "passport";
import session from "express-session";
import connnectDb from "./connections/connection.js";
import userRoute from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoute.js"
import nocache from "nocache";
import { config } from "dotenv";
import './utils/googleAuth.js';


config();  

const app = express();
const PORT = 8000;


app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(nocache());

// Express session
app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use('/', userRoute); 
app.use('/admin', adminRoutes)

connnectDb();

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
