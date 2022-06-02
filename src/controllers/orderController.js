const mongoose = require('mongoose')

const productModel = require('../models/productModel')
const cartModel = require('../models/cartModel')
const orderModel = require('../models/orderModel')
const {userModel} = require("../models/userModel")
const {printError, isValid} = require('../validation/validator')


//Create Order API Handler Function
const createOrder = async (req, res) => {
    try{
        let data = req.body, error = []
        let userId = req.params.userId
        let cartId = data.cartId

        if(!isValid(userId)) error.push('UserId is required')
        if(isValid(userId) && !mongoose.isValidObjectId(userId)) error.push(`'${userId}' is an Invalid UserId.`)
        if(!isValid(cartId)) error.push('CartId is required')
        if(isValid(cartId) && !mongoose.isValidObjectId(cartId)) error.push(`'${cartId}' is an Invalid CartId.`)
    
        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})//Printing all Bad request Errors

        let findUser = await userModel.findById(userId)
        // let findCart = await cartModel.findById(cartId)
        let findCart = await cartModel.findOne({userId})//finding cart with UserId to minimize some codes which otherwise'd berequired

        if(!findUser)
            return res.status(404).send({status: false, message: `User doesn't exist.`})
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: 'User not Authorised. Please sign in first.'})

        if(!findCart)
            return res.status(404).send({status: false, message: "User doesn't have a cart. Please create one and add items."})
        if(findCart && findCart._id != cartId)
            return res.status(403).send({status: false, message: "Cart doesn't belong to the user. Provide correct CartId"})
        if(!findCart.items.length)
            return res.status(400).send({status: false, message: "There are no items in cart to checkout. May be you've already placed the Order"})

        //checks if any tiems is cart are out of stock or deleted from DB
        let arr = findCart.items.map(x => x.productId)
        let pdInStock = (await productModel.find({_id: arr})).filter(x => x.isDeleted).map(x => x._id)
        if(pdInStock.length) 
            return res.status(404).send({status: false, message: `${pdInStock.join(', ')} ${pdInStock.length>1? "have":"has"} been deleted. Can't place order.`})
        
        data.userId = userId
        data.items = findCart.items
        data.totalItems = findCart.items.length
        data.totalQuantity = data.items.reduce((acc,curr) => {acc += curr.quantity; return acc},0)
        data.totalPrice = findCart.totalPrice
        let order = await orderModel.create(data)
        await cartModel.findOneAndUpdate({_id: cartId},{items: [], totalItems: 0, totalQuantity: 0, totalPrice: 0},{new:true})
        res.status(201).send({status: true, message: "Order Created successfully.", data: order})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


//Update Order API Handler Function
const updateOrder = async (req, res) => {
    try{
        let data = req.body, error = []
        let userId = req.params.userId
        let oId = data.orderId
        let status = data.status

        if(!isValid(userId)) error.push('UserId is required')
        if(isValid(userId) && !mongoose.isValidObjectId(userId)) error.push(`'${userId}' is an Invalid UserId.`)
        if(!isValid(oId)) error.push('OrderId is required')
        if(isValid(oId) && !mongoose.isValidObjectId(oId)) error.push(`'${oId}' is an Invalid OrderId.`)
    
        if(printError(error)) return res.status(400).send({status: false, message: printError(error)})//Printing all Bad request Errors

        let findUser = await userModel.findById(userId)
        let findOrder = await orderModel.findOne({_id: oId, isDeleted: false})

        if(!findUser)
            return res.status(404).send({status: false, message: `User doesn't exist.`})
        if(userId != req.headers['valid-user'])
            return res.status(403).send({status: false, message: 'User not Authorised. Please sign in first.'})
        if(!findOrder)
            return res.status(404).send({status: false, message: "Can't find the Order, Check if you've placed any Order."})
        if(!isValid(status))
            return res.status(400).send({status: false, message: "'status' is required."})
        if(findOrder.status != 'pending')
            return res.status(404).send({status: false, message: `Order status: ${findOrder.status}. Can't Update.`})
        if(!['completed', 'cancled', 'cancelled'].includes(status))
            return res.status(400).send({status: false, message: "Only 'completed' or 'cancled' status code are allowed."})
        if(findOrder && findOrder.userId != userId)
            return res.status(403).send({status: false, message: "This order doesn't belong to the user. Can't Update."})
        if(!findOrder.cancellable && ['cancled', 'cancelled'].includes(status))
            return res.status(405).send({status: false, message: "This order can't be cancelled. SORRY!!!"})

        let cancelOrder = await orderModel.findOneAndUpdate({_id: oId},{status},{new: true})

        res.status(200).send({status: true, message: "Order cancelled successfully.", data: cancelOrder})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


module.exports = {createOrder, updateOrder}