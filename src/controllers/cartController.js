const mongoose = require('mongoose')
const cartModel = require('../models/cartModel')
const productModel = require('../models/productModel')
const {userModel} = require("../models/userModel")
const {printError, isValid, isJSON} = require('../validation/validator')


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

        let findUser = await userModel.findById(userId)
        let findCart = await cartModel.findById(cartId)

        if(!findUser)
            return res.status(404).send({status: false, message: "User Profile doesn't exist. Try creating your profile."})
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: 'User not Authorised.'})
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Enter product Data to add to your cart."})
        if(isValid(cartId) && !findCart)
            return res.status(404).send({status: false, message: 'Enter valid CartId if you already have a cart or create a new cart.'})

        if(!isValid(data.productId)) error.push("productId is required")
        if(isValid(data.productId) && !mongoose.isValidObjectId(data.productId)) error.push("productId is Invalid")
        if(!isValid(data.quantity)) data.quantity = 1
        if(data.quantity < 1 || !Number.isInteger(data.quantity)) error.push("Quantity of item(s) should be a an integer & > 0.")

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        let product = await productModel.findById(data.productId)

        if(!product || product.isDeleted) return res.status(404).send({status: false, message: "This product is either Out of Stock or deleted"})

        if(findCart){
            if(userId != findCart.userId)
                return res.status(403).send({status: false, message: "This is not your cart. Please try updating your cart."})

            let temp = findCart.items.find(x => x.productId.toString() == data.productId)
            if(temp) temp.quantity +=data.quantity
            else findCart.items.push({productId: data.productId, quantity: data.quantity})

            data.items = findCart.items
            data.totalItems = data.items.length
            data.totalQuantity = data.items.reduce((acc,curr) => {acc += curr.quantity; return acc},0)
            data.totalPrice = findCart.totalPrice + data.quantity * product.price

            let updateCart = await cartModel.findOneAndUpdate({_id:cartId, isDeleted: false},data,{new: true})
            res.status(200).send({status: true, message: "Cart Updated.", data: updateCart})
        }
        else{
            let findCart = await cartModel.findOne({userId})
            if(findCart)
                return res.status(400).send({status: false, message: "You already have a cart. Please send CartId in data to update your cart."})

            data.userId = userId
            data.items = [{productId: data.productId, quantity: data.quantity}]
            data.totalItems = data.items.length
            data.totalQuantity = data.quantity
            data.totalPrice = product.price
            
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
        let userId = req.params.userId
        let cartId = data.cartId
        let productId = data.productId
        
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Please provide product data to update your cart."})

        if(!isValid(cartId)) error.push("cartId is required")
        if(isValid(cartId) && !mongoose.isValidObjectId(cartId)) error.push(`'${cartId}' is an Invalid CartId.`)
        if(!isValid(productId)) error.push("productId is required")
        if(isValid(productId) && !mongoose.isValidObjectId(productId)) error.push(`'${productId}' is an Invalid ProductId.`)
        if(!isValid(data.removeProduct)) error.push("removeProduct is required")
        if(data.removeProduct > 1 || data.removeProduct < 0) error.push("'removeProduct' for each product should be 1 or 0.")

        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})

        let findUser = await userModel.findById(userId)
        let findCart = await cartModel.findById(cartId)
        let product = await productModel.findById(productId)

        if(!findUser)
            return res.status(404).send({status: false, message: "User Profile doesn't exist. Can't update Cart."})
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: 'User not Authorised.'})
        if(findCart && userId != findCart.userId)
            return res.status(403).send({status: false, message: "This is not your cart. Please try updating your cart."})
        if(!findCart) 
            return res.status(404).send({status: false, message: "Invalid cartId/You don't have a cart. Kindly provide correct cartId"})
        if(findCart && !findCart.items.length)
            return res.status(400).send({status: false, message: "Cart is empty. Can't update anything in it."})

        let itemsinCart = findCart.items.map(x => x.productId.toString())
        if(!itemsinCart.includes(productId))
            return res.status(400).send({status: false, message: "This item is not in the cart. Try updating item that is already in your cart."})

        for(let ele of findCart.items){
            if(ele.productId == data.productId){
                if(data.removeProduct == 0){
                    findCart.totalPrice -= ele.quantity * product.price
                    ele.quantity = 0
                }
                else if(data.removeProduct == 1){
                    if(product.isDeleted) return res.status(404).send({status: false, message: "This product is deleted from DB/OutofStock. Try removing instead."})
                    findCart.totalPrice -= 1 * product.price
                    --ele.quantity
                }
            }
        }
        
        findCart.items = findCart.items.filter(x => x.quantity != 0)
        findCart.totalQuantity = findCart.items.reduce((acc,curr) => {acc += curr.quantity; return acc},0)
        findCart.totalItems = findCart.items.length

        let updatedCart = await cartModel.findOneAndUpdate({_id:cartId},findCart,{new: true})
        if(!updatedCart.items.length)
            return res.status(200).send({status: false, message: 'Cart Emptied.', data: updatedCart})

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
            return res.status(403).send({status: false, message: 'User not Authorised. Please sign in first.'})
        
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
            return res.status(403).send({status: false, message: 'User not Authorised. Please sign in first.'})

        let findCart = await cartModel.findOne({userId})

        if(!findCart.items.length)
            return res.status(404).send({status: false, message: `Cart is already empty. Nothing to delete.`})

        let deleteCart = await cartModel.findOneAndUpdate({userId},{items: [], totalPrice: 0, totalQuantity: 0, totalItems: 0},{new: true})
        if(!deleteCart)
            return res.status(404).send({status: false, message: "User doesn't have a cart to delete."})

        res.status(204).send({status: true, message: "Cart deleted successfully."})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


module.exports = {createCart, updateCart, getCart, deleteCart}