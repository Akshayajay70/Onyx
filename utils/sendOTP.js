import nodemailer from 'nodemailer'
import {config} from "dotenv"
config()

const transporter = nodemailer.createTransport({
    host:"smtp.gmail.com",
    service: "gmail",
    port:587,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
});


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString()


const sendOTPEmail = async (email, otp) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP code is: ${otp}`,

        });
    } catch (error) {
        console.error("Error sending OTP email:", error);
    }
};

export { generateOTP, sendOTPEmail };