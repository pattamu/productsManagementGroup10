const pinCheck = require('../controllers/axios')

/*************************************************************************************/
const reg = {
    nameRegEx: /^(?![\. ])[a-zA-Z\. ]+(?<! )$/ ,
    emailRegEx: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/ ,
    mobileRegEx:  /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/ ,
    pincodeRegEx: /^[1-9]{1}[0-9]{2}\s{0,1}[0-9]{3}$/
}
/**********************************************************************************/

//Print Error function
const printError = error => {
    if(error.length == 1) return error.toString()
    else if(error.length > 1) return error
}

//Name Formator
const formatName = (data) => {
    if(typeof data === 'string')
        return data.split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join(' ') 
    else{
        for(let key in data){
            if(typeof data[key] === 'object'){
                for(let subKey in data[key]){
                    data[key][subKey] = data[key][subKey].toString().trim()
                    data[key][subKey] = data[key][subKey].split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join(' ')
                }
            }
        }
        return data
    }
}

//Image file Validation
const isFileImage = (file) => {
    let ext = ['png', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'webp']
    let fileExt = file.originalname.split('.')
    return ext.includes(fileExt[fileExt.length-1])
}

//RegEx Validation
const validRegEx = (data, regName) => {
    return reg[regName].test(data.toString().trim());
}

//pincode Validation 
const checkPinCode = async (pin) => {
    if(isValid(pin)){
        if(validRegEx(pin, 'pincodeRegEx')){
            if(!await pinCheck(pin))
                return("Doesn't exist in India")
            else return 'OK'
        }else 
            return('Invalid')
    }else 
        return('Is required')
}

//check Validity for key value
const isValid = (value) => {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    return true;
}

//check if a string is JSON or not (Not used in this project)
const isJSON = (str) => {
    try {
        if(!isNaN(str)) return false //in case 'str' is a number then it'll return 'false'
        return (JSON.parse(str) && !!str);
    } catch (e) {
        return false;
    }
}

module.exports = {printError, formatName, isFileImage, validRegEx, checkPinCode, isValid, isJSON}