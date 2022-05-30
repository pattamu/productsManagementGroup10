const express = require('express');
const router = express.Router();

const {createUser, getUser, updateUser} = require('../controllers/userController')
const {createProduct, getProducts, getProduct, updateProduct, deleteProduct} = require('../controllers/productController')
const {createCart, updateCart, getCart, deleteCart} = require('../controllers/cartController')
const {createOrder, updateOrder} = require('../controllers/orderController')
const {userLogin} = require('../controllers/loginController')
const {userAuthentication} = require('../middlewares/authentication')

//User API Routes
router.post('/register', createUser)
router.post('/login', userLogin)
router.get('/user/:userId/profile', userAuthentication, getUser)
router.put('/user/:userId/profile', userAuthentication, updateUser)

//Product API Routes
router.post('/products', createProduct)
router.get('/products', getProducts)
router.get('/products/:productId', getProduct)
router.put('/products/:productId', updateProduct)
router.delete('/products/:productId', deleteProduct)

//Cart API Routers
router.post('/users/:userId/cart', userAuthentication, createCart)
router.put('/users/:userId/cart', userAuthentication, updateCart)
router.get('/users/:userId/cart', userAuthentication, getCart)
router.delete('/users/:userId/cart', userAuthentication, deleteCart)

//Order API Routes
router.post('/users/:userId/orders', userAuthentication, createOrder)
router.put('/users/:userId/orders', userAuthentication, updateOrder)

module.exports = router