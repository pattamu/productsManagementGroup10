const pinCheck = require('../controllers/axios')

/*************************************************************************************/
const reg = {
    nameRegEx: /^(?![\. ])[a-zA-Z\. ]+(?<! )$/ ,
    emailRegEx: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/ ,
    mobileRegEx: /^(\+\d{1,3}[- ]?)?\d{10}$/ ,
    pincodeRegEx: /^[1-9]{1}[0-9]{2}\s{0,1}[0-9]{3}$/
}
// let nameRegEx = /^(?![\. ])[a-zA-Z\. ]+(?<! )$/ 
// let emailRegEx = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/ 
// let mobileRegEx = /^(\+\d{1,3}[- ]?)?\d{10}$/ 
let pincodeRegEx = /^[1-9]{1}[0-9]{2}\s{0,1}[0-9]{3}$/
/**********************************************************************************/


//Image file Validation
const isFileImage = (file) => {
    let ext = ['png', 'jpg', 'jpeg']
    let fileExt = file.originalname.split('.')
    return ext.includes(fileExt[fileExt.length-1])
}

//RegEx Validation
const validateURL = (url, urlPattern) => {
    return urlPattern.test(url.toString().trim());
}

//pincode Validation 
const checkPinCode = async (pin) => {
    if(isValid(pin)){
        if(pincodeRegEx.test(pin)){
            if(!await pinCheck(pin))
                return("pincode doesn't exist")
            else return 'OK'
        }else 
            return('enter a valid pincode')
    }else 
        return('Pincode is required')
}

//check Validity for key value
const isValid = (value) => {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    return true;
}

module.exports = {isFileImage, validateURL, checkPinCode, isValid}