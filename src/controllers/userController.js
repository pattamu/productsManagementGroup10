const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const saltRounds = 10

const uploadFile = require('./awsConnect')
const {userModel, passwordModel} = require("../models/userModel")
const {printError, formatName, isFileImage, validRegEx, checkPinCode, isValid, isJSON} = require('../validation/validator')


//Create User API Handler Function
const createUser = async (req, res) => {
    try{
        let tempPass = req.body.password
        let data = JSON.parse(JSON.stringify(req.body))
        let error = []

        if(typeof data.address == 'string' && !isJSON(data.address))
            return res.status(400).send({status: false, message: "Please send a valid JSON data for address."})

        let findEmail = await userModel.findOne({email: data.email})
        let findPhone = await userModel.findOne({phone: data.phone})

        //checking if body is empty
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Enter data to create User."})
        
        //First Name validation check
        if(!isValid(data.fname))
            error.push('First name is required')
        if(isValid(data.fname) && !validRegEx(data.fname, 'nameRegEx'))
            error.push('F-Name is Invalid')
        //Last Name validation check
        if(!isValid(data.lname))
            error.push('Last name is required')
        if(isValid(data.lname) && !validRegEx(data.lname, 'nameRegEx'))
            error.push('L-Name is Invalid')

        //E-mail validation check
        if(!isValid(data.email))
            error.push('E-Mail is required')
        if(isValid(data.email) && !validRegEx(data.email, 'emailRegEx'))
            error.push('E-Mail is Invalid')
        if(findEmail)
            error.push('E-Mail is already used')

        //check if file is present
        if(!req.files.length)
            error.push("Image file is required")
        //check if file is an image (Remeber 'field name' in postman is optional while uploading file)
        if(req.files.length){
            let check = isFileImage(req.files[0])
            if(!check) 
                error.push('Invalid file, Image only allowed')
        }

        //Phone validation check
        if(!isValid(data.phone))
            error.push('Phone Number is required')
        else
            data.phone = data.phone.toString().trim()//converting phone number to String in case it's in Number
        if(isValid(data.phone) && !validRegEx(data.phone, 'mobileRegEx'))
            error.push('Phone Number is Invalid')
        if(findPhone)
            error.push('Phone Number is already used')
        
        //password check
        if(!isValid(data.password))
            error.push('Password is required')
        if(isValid(data.password) && (data.password.trim().length < 8 || data.password.trim().length > 15))
            error.push('Password is Invalid - must be of length 8 to 15')

        //address checking and street, city, picode required check
        if(isValid(data.address)){
            if(typeof data.address == 'string')
                data.address = JSON.parse(data.address)
            if(!isValid(data.address.shipping) || !isValid(data.address.billing))
                error.push('Both Shipping & Billing Address are required')
            if(!isValid(data.address.shipping.street) || !isValid(data.address.shipping.city) || !isValid(data.address.shipping.pincode))
                error.push('Street, city & pincode are required in shipping address')
            if(!isValid(data.address.billing.street) || !isValid(data.address.billing.city) || !isValid(data.address.billing.pincode))
                error.push('Street, city & pincode are required in billing address')
        } else error.push('Address is required')

        //checking if address and pincode both present and if pincode is valid
        if(isValid(data.address) && isValid(data.address.shipping.pincode) && isValid(data.address.billing.pincode)){
            //PinCode Check for shipping address
            let checkPinShipping = await checkPinCode(data.address.shipping.pincode)
            if(checkPinShipping != 'OK') error.push(`Shipping Pincode: ${checkPinShipping}`)
            //PinCode Check for billing address
            let checkPinBilling = await checkPinCode(data.address.billing.pincode)
            if(checkPinBilling != 'OK') error.push(`Billing Pincode: ${checkPinBilling}`)
        }

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        data.password = await bcrypt.hash(data.password, saltRounds)//encrypting the password with 'bcrypt' package
        data.profileImage = await uploadFile(req.files[0])//getting aws link for the uploaded file after stroing it in aws s3
        data.fname = formatName(data.fname)
        data.lname = formatName(data.lname)
        data.address = formatName(data.address)

        const createUser = await userModel.create(data)
        /************************Storing Password for MySelf*******************************/
        await passwordModel.create({userId: createUser._id, email: createUser.email,password: tempPass})
        /*********************************************************************************/
        res.status(201).send({status: true, message: 'User created successfully.', data: createUser})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


//Get User Data API Handler Function 
const getUser = async (req, res) => {
    try{
        let userId = req.params.userId
        if(!mongoose.isValidObjectId(userId))
            return res.status(400).send({status: false, message: `'${userId}' is an Invalid userId.`})
            
        let userDetails = await userModel.findById(userId)

        if(!userDetails) return res.status(404).send({status: false, message: "User Not Found."}) 
        
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: 'User not Authorised.'})
        
        res.status(200).send({status: true, message: 'success', data: userDetails})
    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


// Update user Data API Handler Function
const updateUser = async (req, res) => {
    try{
        let userId = req.params.userId
        let tempPass = req.body.password
        let data = JSON.parse(JSON.stringify(req.body))
        let error = []
        
        if(typeof data.address == 'string' && !isJSON(data.address))
            return res.status(400).send({status: false, message: "Please send a valid JSON data for address."})

        let findEmail = await userModel.findOne({email: data.email})
        let findPhone = await userModel.findOne({phone: data.phone})

        if(!mongoose.isValidObjectId(userId))
            return res.status(400).send({status: false, message: `'${userId}' is not a valid ObjectId.`})

        let findUser = await userModel.findOne({_id: userId})
        if(!findUser)
            return res.status(404).send({status: false, message: `'${userId}' is not present in our User collection.`})

        /***************************************User AuthoriZation check**********************************/
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: "User not Authorised. Can't update data"})
        /**************************************************************************************************/
        
        //checking if body is empty
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Can't Update User without any data."})

        //First Name validation check
        if(isValid(data.fname) && !validRegEx(data.fname, 'nameRegEx'))
            error.push('F-Name is Invalid')
        //Last Name validation check
        if(isValid(data.lname) && !validRegEx(data.lname, 'nameRegEx'))
            error.push('L-Name is Invalid')

        //E-Mail validation check
        if(isValid(data.email) && !validRegEx(data.email, 'emailRegEx'))
            error.push('E-Mail is Invalid')
        if(findEmail && findEmail._id != userId)
            error.push('E-Mail is already used')

        //Phone validation check
        if(isValid(data.phone) && !validRegEx(data.phone, 'mobileRegEx'))
            error.push('Phone Number is Invalid')
        if(findPhone && findPhone._id != userId)
            error.push('Phone Number is already used')

        //checking if address and pincode both present and if pincode is valid
        if(isValid(data.address)){
            if(typeof data.address == 'string')
                data.address = JSON.parse(data.address)
            //PinCode Check for shipping address
            if(isValid(data.address?.shipping?.pincode)){
                let checkPinShipping = await checkPinCode(data.address.shipping.pincode)
                if(checkPinShipping != 'OK') error.push(`Shipping Pincode: ${checkPinShipping}`)
            }
            //PinCode Check for billing address
            if(isValid(data.address?.billing?.pincode)){
                let checkPinBilling = await checkPinCode(data.address.billing.pincode)
                if(checkPinBilling != 'OK') error.push(`Billing Pincode: ${checkPinBilling}`)
            }
        }

        //Password validity check
        if(isValid(data.password) && (data.password.length < 8 || data.password.length > 15))
            error.push('Password is Invalid - must be of length 8 to 15')

        //check if file is an image (Remeber 'field name' in postman is optional while uploading file)
        if(req.files.length){
            if(!isFileImage(req.files[0])) 
                error.push('Invalid file, Image only allowed')
            else 
                data.profileImage = await uploadFile(req.files[0])
        }

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        if(isValid(data.password))
            data.password = await bcrypt.hash(data.password, saltRounds)//encrypting the password with 'bcrypt' package
        if(isValid(data.fname)) data.fname = formatName(data.fname)
        if(isValid(data.lname)) data.lname = formatName(data.lname)
        if(isValid(data.address)) data.address = formatName(data.address)
        
        const oldUserData = await userModel.findById(userId)

        const updateUser = await userModel.findOneAndUpdate({_id: userId},{
            fname: data.fname, lname: data.lname, email: data.email, profileImage: data.profileImage, phone: data.phone, password: data.password,
            address: {
                shipping:{
                    street: data.address?.shipping?.street || oldUserData.address.shipping.street,
                    city: data.address?.shipping?.city || oldUserData.address.shipping.city,
                    pincode: data.address?.shipping?.pincode || oldUserData.address.shipping.pincode
                },
                billing:{
                    street: data.address?.billing?.street || oldUserData.address.billing.street,
                    city: data.address?.billing?.city || oldUserData.address.billing.city,
                    pincode: data.address?.billing?.pincode || oldUserData.address.billing.pincode
                }
            }
        },{new: true})
        /************************Storing Password for MySelf*******************************/
        await passwordModel.findOneAndUpdate({userId: updateUser._id},{email: updateUser.email,password: tempPass}, {new: true})
        /*********************************************************************************/
        res.status(200).send({status: true, message: 'User Updated successfully.', data: updateUser})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


module.exports = {createUser, getUser, updateUser}