import ApiError from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async(req,res)=>{
    // get user details from frontend
      const {fullName , email , username , password } = req.body

    // validation - not empty

      if(
        [fullName,email,username,password].some(field => field?.trim() === '')
      ){
        throw new ApiError(400, 'All fields are required')
      }

      if(password.length < 6){
        throw new ApiError(400, 'Password must be at least 6 characters')
      }
      if(username.length < 3){
        throw new ApiError(400, 'Username must be at least 3 characters')
      }
      if(email.includes('@') === false){
        throw new ApiError(400, 'Email is invalid')
      }

      // check if user already exists: username, email

      const existedUser = await User.findOne({
        $or: [ { username } , { email } ]
      })

      if(existedUser){
        throw new ApiError(409, 'User with this email or username already exists')
      }

    // check for images, check for avatar
      const avatarLocalPath =  req.files?.avatar[0]?.path ;

      let coverLocalPath ;

      if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ){
        coverLocalPath = req.files.coverImage[0].path ;
    }

      if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is required")
      }
    // upload them to cloudinary, avatar

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverImage = await uploadOnCloudinary(coverLocalPath)

     if(!avatar){
        throw new ApiError(500, "Failed to upload avatar image")
     }
     
     // create user object - create entry in db

     const user = await User.create({
       fullName,
       avatar : avatar.url,
       coverImage : coverImage?.url || "" ,
       email,
       password,
       username : username.toLowerCase() 
     })

     // check user creation and  remove password and refresh token field from response
     const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
     )

     if(!createdUser){
        throw new ApiError(500, "Failed to create user Please retry again later")
     }

    // return res
    return res.status(201).json(
        new ApiResponse(201, createdUser , "User Registered Successfully !!")
        )
})

export {registerUser}