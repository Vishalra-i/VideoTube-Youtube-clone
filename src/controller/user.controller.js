import ApiError from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import Jwt  from "jsonwebtoken"

// generate access and refresh token
const generateAcessandRefreshToken = async(userId)=>{
  try {
    const user = await User.findById(userId)

    const accessToken = user.generateAcessToken()
    const refreshToken = user.generateRefeshToken()


    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave : false })


    return { accessToken , refreshToken }  

  } catch (error) {
    throw new ApiError(500, "Failed to generate tokens")
  }
}

//Registration user
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


//Login user
const loginUser =  asyncHandler(async(req,res)=>{
   //get data from frontend
     const {username , email , password } = req.body
    //username or email
    if(!username && !email){
        throw new ApiError(400, "Username or Email is required")
    }

    //find the user
    const user = await User.findOne({
        $or: [ { username } , { email } ]
    })

    if(!user){
        throw new ApiError(404, "User does not exit")
    }
    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    //generate access token and refresh token
    const {accessToken , refreshToken } =  await generateAcessandRefreshToken(user._id)


    //remove password and refreshToken from response
    const loggedUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //send cookie
    const options = {
        httpOnly : true ,
        secure : true 
    }

    //return res
    return res.
    status(200)
    .cookie("refreshToken", refreshToken ,options)
    .cookie("accessToken",accessToken ,options)
    .json(new ApiResponse(200, {
      user: loggedUser,accessToken,refreshToken,
    }, "User logged in successfully"))

})

//Logout user
const logoutUser = asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(req.user._id,
    {
       refreshToken : undefined
    },
    {new : true}
    )

    const options = {
        httpOnly : true ,
        secure : true
    }

    return res.
           status(200)
           .clearCookie("refreshToken",options)
           .clearCookie("accessToken",options)
           .json(new ApiResponse(200, {}, "User logged out successfully"))

})

//Refresh Token for renew acces token
const refreshAccessToken = asyncHandler(async(req, res)=>{
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken
  if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorized request")
  }
  try {
    const decodedToken = Jwt.verify(
      incomingRefreshToken 
      , process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401, "Invalid refreshToken")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh Token is expired or used")
    }
  
    const options = {
      httpOnly : true ,
      secure : true 
    }
  
    const {accessToken , newrefreshToken } = await generateAcessandRefreshToken(user._id)
  
    return res.
    status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newrefreshToken, options)
    .json(new ApiResponse(200, {accessToken , refreshToken : newrefreshToken}, "Access token refreshed successfully"))
  } catch (error) {
      throw new ApiError(401 , error?.message ||  "Invalid refreshToken" )
  
  }

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
}