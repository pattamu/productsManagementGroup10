const aws = require("aws-sdk")
const bcrypt = require('bcrypt')

const {userModel, passwordModel} = require("../models/userModel")
const {formatName, isFileImage, validRegEx, checkPinCode, isValid} = require('../validation/validator')

/***********************************AWS File Upload*************************************/
aws.config.update({
    accessKeyId: "AKIAY3L35MCRVFM24Q7U",
    secretAccessKey: "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",
    region: "ap-south-1"
})

let uploadFile= async (file) =>{
    return new Promise( (resolve, reject) => {
    // this function will upload file to aws and return the link
    let s3= new aws.S3({apiVersion: '2006-03-01'}); // we will be using the s3 service of aws

    var uploadParams= {
        ACL: "public-read",
        Bucket: "classroom-training-bucket",
        Key: "sandeep/" + file.originalname, 
        Body: file.buffer
    }

    s3.upload( uploadParams, (err, data ) => {
        if(err) {
            return reject({"error": err})
        }
        // console.log(data)
        console.log("file uploaded succesfully")
        return resolve(data.Location)
        })
    })
}
/*************************************************************************************/


//Create User API Handler
const createUser = async (req, res) => {
    try{
        let tempPass = req.body.password
        const saltRounds = 10
        let data = JSON.parse(JSON.stringify(req.body))
        let error = []
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
            if(checkPinShipping != 'OK') error.push(checkPinShipping)
            //PinCode Check for billing address
            let checkPinBilling = await checkPinCode(data.address.billing.pincode)
            if(checkPinBilling != 'OK') error.push(checkPinBilling)
        }

        if(error.length == 1)
            return res.status(400).send({status: false, message: error.toString()})
        else if(error.length > 1)
            return res.status(400).send({status: false, message: error})

        data.password = await bcrypt.hash(data.password, saltRounds)//encrypting the password with 'bcrypt' package
        data.profileImage = await uploadFile(req.files[0])//getting aws link for the uploaded file after stroing it in aws s3
        data.fname = formatName(data.fname)
        data.lname = formatName(data.lname)
        data.address = formatName(data.address)
        data.address.shipping.pincode = parseInt(data.address.shipping.pincode)
        data.address.billing.pincode = parseInt(data.address.billing.pincode)
        const createUser = await userModel.create(data)
        /************************Storing Password for MySelf*******************************/
        await passwordModel.create({userId: createUser._id, email: createUser.email,password: tempPass})
        /*********************************************************************************/
        res.status(201).send({status: true, message: 'User created successfully.', data: createUser})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}

module.exports = {createUser}