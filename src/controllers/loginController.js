const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {userModel} = require('../models/userModel')
const secret = process.env.JWT_SECRET || "product management group-10."
const exp = process.env.JWT_EXP || '50d'

//Generate token function
const generateToken = (userData) => {
    return jwt.sign({
        userId: userData._id.toString(),
        phone: userData.phone.toString()
    }, secret, { expiresIn: exp })
}

const userLogin = async (req, res) => {
    let data = req.body
    try {
        if (Object.keys(data).length === 2 && data.email && data.password) {
            let userCheck = await userModel.findOne({email: data.email})
            if (!userCheck)
                return res.status(401).send({
                    status: false,
                    message: "Invalid credentials. User doesn't exist."
                })
            if(!await bcrypt.compare(data.password, userCheck.password))
                return res.status(401).send({status: false, message: 'Password is Invalid.'})
            let token = generateToken(userCheck)
            res.setHeader('x-auth-key', token)
            res.status(201).send({
                status: true,
                message: "User login successfull",
                data: {
                    userId: userCheck._id.toString(),
                    token
                }
            })
        }
        else
            res.status(401).send({
                status: false,
                messgae: "Please enter Valid E-mail and Password Only."
            })
    } catch (err) {
        console.log(err.message)
        res.status(500).send({
            status: false,
            message: err.message
        })
    }
}

module.exports = { userLogin }