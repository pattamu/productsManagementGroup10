const axios = require('axios')

const pincodeCheck = async (pin) => {
    try{
        let fetch = {
            method: 'get',
            url: `https://api.postalpincode.in/pincode/${pin}`
        }
        let {data} = await axios(fetch) //returns data if pincode exists and 'null' if doesn't exist
        if(data[0].PostOffice)
            return true
        else return false
    }catch(err){
        console.log(err.message) 
    }
}

module.exports = pincodeCheck