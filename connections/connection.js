import mongoose from 'mongoose'
import { config } from "dotenv";

config()


const connnectDb = async () => {
    try {
        const connection = await mongoose.connect(process.env.HOST)
        console.log("DB STATUS", "connected successfully")

    } catch (error) {
        console.log("DB STATUS", error)
    }
}

export default connnectDb