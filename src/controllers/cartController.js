const mongoose = require('mongoose')
const cartModel = require('../models/cartModel')
const productModel = require('../models/productModel')
const {userModel} = require("../models/userModel")
const {isValid, isJSON} = require('../validation/validator')

function printError(error){
    if(error.length == 1) return error.toString()
    else if(error.length > 1) return error
}

//createcart can take input in raw JSON as well as in form data
const createCart = async (req, res) => {
    try{
        let data = req.body, error = []

        if(!isValid(data.cartId)) delete data.cartId

        let userId = req.params.userId
        let cartId = data.cartId

        if(!isValid(userId)) error.push('UserId is required')
        if(isValid(userId) && !mongoose.isValidObjectId(userId)) error.push(`'${userId}' is an Invalid UserId.`)
        if(isValid(cartId) && !mongoose.isValidObjectId(cartId)) error.push(`'${cartId}' is an Invalid CartId.`)

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        if(typeof data.items == 'string' && !isJSON(data.items))
            return res.status(400).send({status: false, message: "Please send a valid JSON data for items."})

        if(typeof data.items == 'string') data.items = JSON.parse(data.items)

        let findUser = await userModel.findById(userId)
        let findCart = await cartModel.findById(cartId)

        if(!findUser)
            return res.status(404).send({status: false, message: "User Profile doesn't exist. Try creating your profile."})
        if(userId != req.headers['valid-user'])
            return res.status(401).send({status: false, message: 'User not Authorised.'})
        if(isValid(cartId) && !findCart)
            return res.status(404).send({status: false, message: 'Enter valid CartId if you already have a cart or create a new cart.'})

        /****************************To Support different types of inputs from req.body*************************/
        if(isValid(data.items) && typeof data.items == 'object' && !Array.isArray(data.items))
            data.items = [data.items]
        if(Object.keys(data).length && !isValid(data.items)){
            if(!isValid(data.productId)) error.push("productId is required")
            if(!isValid(data.quantity)) error.push("quantity is required")
            if(printError(error)) return res.status(400).send({status: false, message: printError(error)})
            data.items = [{productId: data.productId, quantity: data.quantity}]
        }
        /*******************************************************************************************************/

        if(data.items?.length)
            data.items = data.items?.filter(x => Object.keys(x).length)//filtering out empty Objects from items Array

        if(!Object.keys(data).length || !data.items?.length)
            return res.status(400).send({status: false, message: "You must add atleast 1 qty of any product to your cart."})

        if(data.items.some(x => !isValid(x.productId))) error.push("'productId' is required for each product.")
        if(data.items.some(x => isValid(x.productId) && !mongoose.isValidObjectId(x.productId))) error.push("ProductId(s) is/are Invalid.")
        if(data.items.some(x => !isValid(x.quantity))) error.push("'quantity' is required for each product.")
        if(data.items.some(x => x.quantity && (x.quantity < 0 || !Number.isInteger(x.quantity)))) error.push("Quantity of item(s) should be a an integer & > 0")

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        data.items = data.items?.filter(x => x.quantity > 0)//filters out all items with 0 quantity

        /**********************This Function Calculates the 'totalPrice' & 'totalQuantity'**************************/
        const total = (bodyData, productdata) => {
            let obj = {totalPrice:0}
            for(let i in productdata) obj.totalPrice += productdata[i].price * bodyData.items[i].quantity
            obj.totalQuantity = bodyData.items.reduce((acc,curr) => {acc += curr.quantity; return acc},0)
            return obj
        }
        /*******This function will return all products data respective to the productId sent in req.body*********/
        const getProductsData = async data => {
            let arr = data.items.map(x => x.productId)
            let products = await productModel.find({_id:arr})
            if(products.some(x => x.isDeleted)) return false
            else return products
        }
        /********************************************************************************************************/
        
        if(findCart){
            if(userId != findCart.userId)
                return res.status(401).send({status: false, message: "This is not your cart. Please try updating your cart."})

            let products = await getProductsData(data)
            if(!products) 
                return res.status(404).send({status: false, message: `You're trying add some item(s) which have/has been deleted.`})

            let tot = total(data, products)//'data' we recive from req.body & 'products' are BD data for same items
            data.totalPrice = tot.totalPrice + findCart.totalPrice
            data.totalQuantity = tot.totalQuantity + findCart.totalQuantity

            for(let i in data.items){
                let temp = findCart.items.find(x => x.productId == data.items[i].productId)
                if(temp)
                    data.items[i].quantity += temp.quantity
            }
            let temp = data.items.map(x => x.productId)
            findCart.items.forEach(x => {
                if(!temp.includes(x.productId.toString()))//if ObjId is in Object format we've to convert to string to compare 
                    data.items.push(x)
            })
            data.totalItems = data.items.length
            let updateCart = await cartModel.findOneAndUpdate({_id:cartId, isDeleted: false},data,{new: true})
            res.status(201).send({status: true, message: "Cart Updated.", data: updateCart})
        }
        else{
            let findCart = await cartModel.findOne({userId})
            if(findCart)
                return res.status(400).send({status: false, message: "You already have a cart. Please send CartId in data to update your cart."})

            let products = await getProductsData(data)
            if(!products) 
                return res.status(404).send({status: false, message: `You're trying add some item(s) which have/has been deleted.`})

            let tot = total(data, products)//'data' we recive from req.body & 'products' are BD data for same items
            data.totalPrice = tot.totalPrice
            data.totalQuantity = tot.totalQuantity
            data.totalItems = data.items.length
            data.userId = userId
            let createcart = await cartModel.create(data)
            res.status(201).send({status: true, message: "cart created successfully.", data: createcart})
        }
    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const updateCart = async (req, res) => {
    try{
        let data = req.body, error = []

        if(typeof data.items == 'string' && !isJSON(data.items))
            return res.status(400).send({status: false, message: "Please send a valid JSON data for items."})

        if(typeof data.items == 'string') data.items = JSON.parse(data.items)

        let userId = req.params.userId
        let cartId = data.cartId

        /****************************To Support different types of inputs from req.body*************************/
        if(isValid(data.items) && typeof data.items == 'object' && !Array.isArray(data.items))
            data.items = [data.items]
        if(Object.keys(data).length && !isValid(data.items)){
            if(!isValid(data.productId)) error.push("productId is required")
            if(!isValid(data.removeProduct)) error.push("quantity is required")
            if(printError(error)) return res.status(400).send({status: false, message: printError(error)})
            data.items = [{productId: data.productId, removeProduct: data.removeProduct}]
        }
        /*******************************************************************************************************/
        if(data.items?.length)
            data.items = data.items?.filter(x => Object.keys(x).length)//filtering out empty Objects from items Array

        if(!Object.keys(data).length || !data.items?.length)
            return res.status(400).send({status: false, message: "Please provide product data to update your cart."})
        
        if(!isValid(userId)) error.push('UserId is required')
        if(isValid(userId) && !mongoose.isValidObjectId(userId)) error.push(`'${userId}' is an Invalid UserId.`)
        if(!isValid(cartId)) error.push('CartId is required')
        if(isValid(cartId) && !mongoose.isValidObjectId(cartId)) error.push(`'${cartId}' is an Invalid CartId.`)

        if(data.items?.some(x => !isValid(x.productId) || !isValid(x.removeProduct))) error.push("'productId' & 'removeProduct' both required for each product.")
        if(data.items?.some(x => isValid(x.productId) && !mongoose.isValidObjectId(x.productId))) error.push("ProductId(s) is/are Invalid.")
        if(data.items?.some(x => x?.removeProduct > 1 || x?.removeProduct < 0)) error.push("'removeProduct' for each product should be 1 or 0.")

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        let findUser = await userModel.findById(userId)
        let findCart = await cartModel.findById(cartId)

        if(!findUser)
            return res.status(404).send({status: false, message: "User Profile doesn't exist. Can't update Cart."})
        if(userId != req.headers['valid-user'])
            return res.status(401).send({status: false, message: 'User not Authorised.'})
        if(findCart && userId != findCart.userId)
            return res.status(401).send({status: false, message: "This is not your cart. Please try updating your cart."})
        if(!findCart) 
            return res.status(404).send({status: false, message: "Invalid cartId/You don't have a cart. Kindly provide correct cartId"})
        if(findCart && !findCart.items.length)
            return res.status(400).send({status: false, message: "Cart is empty. Can't update anything in it."})

        let temp = findCart.items.map(x => x.productId.toString())

        for(let i in data.items){
            if(!temp.includes(data.items[i].productId))
                return res.status(400).send({status: false, 
                    message: "Some items are not present in the cart. Try updating items that are already in your cart."})
        }//can't use forEach here to avoide "can't set Header after sending to client response error"

        let arr = data.items.map(x => x.productId)
        let products = await productModel.find({_id: arr})
        findCart.items.forEach(ele => {
            let temp = data.items.find(x => x.productId.toString() == ele.productId)
            if(temp?.removeProduct == 0) {
                findCart.totalPrice -= ele.quantity * products.find(x => x._id.toString() == ele.productId).price
                ele.quantity = 0
            }
            else if(temp?.removeProduct == 1) {
                findCart.totalPrice -= 1 * products.find(x => x._id.toString() == ele.productId).price
                --ele.quantity
            }
        })
        findCart.items = findCart.items.filter(x => x.quantity != 0)
        findCart.totalQuantity = findCart.items.reduce((acc,curr) => {acc += curr.quantity; return acc},0)
        findCart.totalItems = findCart.items.length
        let updatedCart = await cartModel.findOneAndUpdate({_id:cartId},findCart,{new: true})
        if(!updatedCart.items.length){
            res.status(200).send({status: false, message: 'Cart Emptied.', data: updatedCart})
            // await cartModel.findOneAndDelete({_id:updatedCart._id})
            return
        }
        res.status(200).send({status: true, message: 'Cart Updated Successfully.', data: updatedCart})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const getCart = async (req, res) => {
    try{
        let userId = req.params.userId

        if(!mongoose.isValidObjectId(userId))
            return res.status(400).send({status: false, message: `'${userId}' is an Invalid User ObjectId.`})

        let findUser = await userModel.findById(userId)

        if(!findUser)
            return res.status(404).send({status: false, message: `User doesn't exist.`})
        if(userId != req.headers['valid-user'])
            return res.status(401).send({status: false, message: 'User not Authorised. Please sign in first.'})
        
        let findCart = await cartModel.findOne({userId})
        if(!findCart)
            return res.status(404).send({status: false, message: "You don't have a cart. Please create a cart by adding some products."})

        res.status(200).send({status: true, message: "Here is your cart details..", data: findCart})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const deleteCart = async (req, res) => {
    try{
        let userId = req.params.userId

        if(!mongoose.isValidObjectId(userId))
            return res.status(400).send({status: false, message: `'${userId}' is an Invalid User ObjectId.`})

        let findUser = await userModel.findById(userId)

        if(!findUser)
            return res.status(404).send({status: false, message: `User doesn't exist.`})
        if(userId != req.headers['valid-user'])
            return res.status(401).send({status: false, message: 'User not Authorised. Please sign in first.'})

        let findCart = await cartModel.findOne({userId})

        if(!findCart.items.length)
            return res.status(404).send({status: false, message: `Cart is already empty. Nothing to delete.`})

        let deleteCart = await cartModel.findOneAndUpdate({userId},{items: [], totalPrice: 0, totalQuantity: 0, totalItems: 0},{new: true})
        if(!deleteCart)
            return res.status(404).send({status: false, message: "User doesn't have a cart to delete."})

        res.status(200).send({status: true, message: "Cart deleted successfully.", data: deleteCart})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


module.exports = {createCart, updateCart, getCart, deleteCart}