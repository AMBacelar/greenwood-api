// @flow
var express = require("express");
var router = express.Router();

type User = {
	password: String,
	email: String,
	firstName: String,
	lastName: String,
	description: String,
};


// Register

// Login

// Logout



// Get user

// SHOW - shows more info about one user


//Update user data


//Destroy user



//middleware
function isLoggedIn() {
}
function checkUserOwnership() {
}

module.exports = router;