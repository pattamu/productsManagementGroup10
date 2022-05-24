const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

const userSchema = new mongoose.Schema({ 
    fname: {type: String, required: true, trim: true},
    lname: {type: String, required: true, trim: true},
    email: {type: String, required: true, unique: true, lowercase: true, trim: true},
    profileImage: {type: String, required: true}, // s3 link
    phone: {type: String, required: true, unique: true, trim: true}, 
    password: {type: String, required: true}, // encrypted password
    address: {
        shipping: {
            street: {type: String, required: true, trim: true},
            city: {type: String, required: true, trim: true},
            pincode: {type: Number, required: true}
        },
        billing: {
            street: {type: String, required: true, trim: true},
            city: {type: String, required: true, trim: true},
            pincode: {type: Number, required: true}
        }
    }
}, {timestamps: true})


const passwordSchema = new mongoose.Schema({
    userId: {type: ObjectId, ref: 'User', required: true},
    email: {type: String, required: true, trim: true, lowercase: true},
    password: {type: String, required: true}
})


const userModel = mongoose.model('User', userSchema)//users
const passwordModel = mongoose.model('Password', passwordSchema)//passwords

module.exports = {userModel, passwordModel}

