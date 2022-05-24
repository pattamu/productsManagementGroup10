const express = require('express');
const router = express.Router();

const {createUser} = require('../controllers/userController')

//User API Route Handlers
router.post('/register', createUser)


module.exports = router