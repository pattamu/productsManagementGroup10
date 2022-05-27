const mongoose = require('mongoose')
const uploadFile = require('./awsConnect')
const productModel = require('../models/productModel')
const {isFileImage, isValid} = require('../validation/validator')

const createProduct = async (req, res) => {
    try{
        let data = JSON.parse(JSON.stringify(req.body))
        let error = []

        //checking if body is empty
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Enter data to create User."})

        //check for title
        if(!isValid(data.title)) error.push('Title is required')
        //check for description
        if(!isValid(data.description)) error.push('Description is required')
        //check for title
        if(!isValid(data.price)) error.push('Price is required')
        //check price validity
        if(isValid(data.price) && (isNaN(data.price) || parseInt(data.price) < 0)) error.push('Price should be a +ve Integer')

        //check if currencyId is 'INR' Only
        if(isValid(data.currencyId) && data.currencyId != 'INR') error.push("CurrencyId can only be 'INR'")
        //check if currencyFormat is '₹' Only
        if(isValid(data.currencyFormat) && data.currencyFormat != '₹') error.push("currencyFormat can only be '₹'")

        //check if isFreeShipping is Boolean
        if(isValid(data.isFreeShipping) && !['true','false'].includes(data.isFreeShipping))
            error.push('isFreeShipping must be a Boolean value')

        //check if file is present
        if(!req.files.length)
            error.push("Image file is required")
        //check if file is an image (Remeber 'field name' in postman is optional while uploading file)
        if(req.files.length){
            let check = isFileImage(req.files[0])
            if(!check) 
                error.push('Invalid file, Image only allowed')
        }

        //check for AvailableSizes
        if(!isValid(data.availableSizes)) error.push('AvailableSizes is required')

        if(isValid(data.availableSizes)){
            let arr = ["S", "XS","M","X", "L","XXL", "XL"]
            data.availableSizes = data.availableSizes.split(/[",\[\]]/).filter(x=>x.trim())
            if(data.availableSizes.some(x => !arr.includes(x.trim())))
                error.push('Size can only be from: S, XS, M, X, L, XXL, XL')
        }

        if(error.length == 1)
            return res.status(400).send({status: false, message: error.toString()})
        else if(error.length > 1)
            return res.status(400).send({status: false, message: error})

        data.availableSizes = [...new Set(data.availableSizes)]
        data.productImage = await uploadFile(req.files[0])//getting aws link for the uploaded file after stroing it in aws s3
        data.isDeleted = false
        const created = await productModel.create(data)
        res.status(201).send({status: true, message: "Product created succefully", data: created})
    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const getProducts = async(req, res) => {
    try{
        let filters = req.query, products, options, options2, newFilter = {} //'options' is for size & 'options2' is for name

        if(isValid(filters.size) || isValid(filters.name)){
            options = filters.size?.split(/[, '"+-;]+/).filter(x=>x.trim()).map(x => {return x.trim() && {availableSizes:x}})
            options2 = filters.name?.split(/[, '"+-;]+/).filter(x=>x.trim()).map(x => {return x.trim() && {title:{$regex: new RegExp(x, 'gi')}}})
        }

        if(isValid(filters.priceGreaterThan)) newFilter.price = {$gt: filters.priceGreaterThan}
        if(isValid(filters.priceLessThan)) newFilter.price = {$lt: filters.priceLessThan}
        if(isValid(filters.priceLessThan) && isValid(filters.priceGreaterThan)) 
            newFilter.price = { $gt: filters.priceGreaterThan, $lt: filters.priceLessThan }

        Object.keys(newFilter).forEach(key => !isValid(newFilter[key]) && delete newFilter[key])
        
        if (isValid(filters.priceSort) && !(filters.priceSort == -1 || filters.priceSort == 1))
            return res.status(400).send({ status: false, message: "You Can Only Use 1 For Ascending And -1 For Descending Sorting" })

        if(!options && !options2)
            products = await productModel.find({$and: [newFilter, {isDeleted: false}]},{__v: 0}).collation({ locale: "en", strength: 2 }).sort({price: filters.priceSort})
        else if(options && !options2)
            products = await productModel.find({$and: [newFilter, {$or:options}, {isDeleted: false}]},{__v: 0}).collation({ locale: "en", strength: 2 }).sort({price: filters.priceSort})
        else if(!options && options2)
            products = await productModel.find({$and: [newFilter, {$or:options2}, {isDeleted: false}]},{__v: 0}).collation({ locale: "en", strength: 2 }).sort({price: filters.priceSort})
        else
            products = await productModel.find({$and: [newFilter,{$or:options},{$or:options2}, {isDeleted: false}]},{__v: 0}).collation({ locale: "en", strength: 2 }).sort({price: filters.priceSort})
        
        if(!products.length)
            return res.status(404).send({ status: false, message: "Product not found." })
        res.status(200).send({status: true, message: "Product data fetched.", data: products})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const getProduct = async (req, res) => {
    try{
        let pId = req.params.productId

        if(!mongoose.isValidObjectId(pId))
            return res.status(401).send({status: false, message: `'${pId}' is an Invalid ProductId.`})

        let product = await productModel.findById(pId)

        if(!product || product.isDeleted)
            return res.status(404).send({ status: false, message: "Product not found." })

        res.status(200).send({status: true, message: "Product data fetched.", data: product})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const updateProduct = async (req, res) => {
    try{
        let pId = req.params.productId
        let data = JSON.parse(JSON.stringify(req.body))
        delete data.isDeleted
        delete data.deletedAt
        let error = []

        if(!mongoose.isValidObjectId(pId))
            return res.status(401).send({status: false, message: `'${pId}' is an Invalid ProductId.`})

        let findProduct = await productModel.findOne({_id: pId, isDeleted: false})
        if(!findProduct)
            return res.status(404).send({status: false, message: `No product found for: '${pId}'`})
        
        if(!Object.keys(data).length)
            return res.status(400).send({status: false, message: "Can't update product without data."})

        if(isValid(data.availableSizes)){
            let arr = ["S", "XS","M","X", "L","XXL", "XL"]
            data.availableSizes = data.availableSizes.split(/[",\[\]]/).filter(x=>x.trim())
            if(data.availableSizes.some(x => !arr.includes(x.trim())))
                error.push('Size can only be from: S, XS, M, X, L, XXL, XL')
        }

        //check if file is an image (Remeber 'field name' in postman is optional while uploading file)
        if(req.files.length){
            if(!isFileImage(req.files[0])) 
                error.push('Invalid file, Image only allowed')
            else 
                data.productImage = await uploadFile(req.files[0])
        }

        if(isValid(data.price) && isNaN(data.price)) error.push('Price should be an Integer')

        if(error.length == 1)
            return res.status(400).send({status: false, message: error.toString()})
        else if(error.length > 1)
            return res.status(400).send({status: false, message: error})

        data['$addToSet'] = {availableSizes: {$each:data.availableSizes||[]}}
        delete data.availableSizes
        let updatedProduct = await productModel.findOneAndUpdate({_id:pId},data,{new:true})
        res.status(200).send({status: true, message: 'successfully updated', data: updatedProduct})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}


const deleteProduct = async (req, res) => {
    try{
        let pId = req.params.productId

        if(!mongoose.isValidObjectId(pId))
            return res.status(401).send({status: false, message: `'${pId}' is an Invalid ProductId.`})

        let deletedProduct = await productModel.findOneAndUpdate({_id: pId, isDeleted: false},{isDeleted: true, deletedAt: Date.now()},{new: true})

        if(!deletedProduct)
            return res.status(404).send({ status: false, message: "Product not found." })

        res.status(200).send({status: true, message: "Product deleted successfully.", data: deletedProduct})

    }catch(err){
        res.status(500).send({status: false, message: err.message})
    }
}

module.exports = {createProduct, getProducts, getProduct, updateProduct, deleteProduct}