const express = require('express');
const router = express.Router();

const {createUser, getUser, updateUser} = require('../controllers/userController')
const {userLogin} = require('../controllers/loginController')
const {userAuthentication} = require('../middlewares/authentication')


//User API Route Handlers
router.post('/register', createUser)
router.post('/login', userLogin)
router.get('/user/:userId/profile', userAuthentication, getUser)
router.put('/user/:userId/profile', userAuthentication, updateUser)

module.exports = router