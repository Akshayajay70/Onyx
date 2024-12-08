import mongoose from 'mongoose'


const connnectDb = async () => {
    try {
        const connection = await mongoose.connect("mongodb://localhost/Onyx")
        console.log("DB STATUS", "connected successfully")

    } catch (error) {
        console.log("DB STATUS", error)
    }
}

export default connnectDb