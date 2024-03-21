import ApiError from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.model.js"
import { deleteOnCloudnary, uploadOnCloudinary } from "../utils/cloudinary.js"
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

//Change Password
const changeCurrentPassword = asyncHandler(async(req,res)=>{
   const {oldPassword , newPassword , confPassword} = req.body

   if(newpassword !== confPassword){
     throw new ApiError(400, "New password and confirm password does not match")
   }

   const user = await User.findById(req.user?._id)
   const isPasswordValid = await user.isPasswordCorrect(oldPassword)

   if(!isPasswordValid){
     throw new ApiError(400, "Invalid old password")
   }

   user.password = newPassword

   await user.save({validateBeforeSave : false})

   return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))

})

//get user details
const getCurrentUser = asyncHandler(async(req,res)=>{
  
   return res
   .status(200)
   .json(new ApiResponse(200, req.user, "User details fetched successfully"))
})

//Update Details
const updateAccountdetails = asyncHandler( async(req , res)=>{
  const {fullName ,email}  = req.body

  if(!fullName || !email){
    throw new ApiError(400, "All Feild are required")
  }

  const user = await User.findByIdAndDelete(req.user._id,
    {
       $set:{
        fullName ,
        email
       }
    },
    {new : true}
    ).select("-password -refreshToken")

    return res.status(200)
           .json( new ApiResponse(200, user, "User details updated successfully"))

})

//Update Avatar
const updateUserAvatar = asyncHandler( async(req, res)=>{
    const updateAvatarLocal = req.file?.path
    
    if(!updateAvatarLocal){
      throw new ApiError(400, "Avatar file is required")
    }

    
    
    const avatar = await uploadOnCloudinary(updateAvatarLocal)
    
    
    if(!avatar.url){
      throw new ApiError(400, "Error While updating avatar in cloudinary")
    }
    
    //Delete Previous Image
    const publicId = req.user.avatar.match(/\/v\d+\/(.+)\.\w{3,4}$/)[1]
    const deletePrevimage =  deleteOnCloudnary(publicId)

    //Find and update user avatar in db  
    const user = await User.findByIdAndUpdate(req.user?._id,{
      $set:{
        avatar : avatar?.url
      }
      
    },{
      new : true
    }).select("-password ").catch(error=>{
      console.log(error);
    })
     
    //return response
    return res.status(200)
    .json(new ApiResponse(200 , user , "Avatar Updated Successfully"))

})
//Update Cover Image
const updateUsercoverImage  = asyncHandler( async(req, res)=>{
    const updatecoverImageLocal = req.file?.path
    
    if(!updatecoverImageLocal){
      throw new ApiError(400, "cover image file is required")
    }
    
    //upload new image
    const coverImage = uploadOnCloudinary(updatecoverImageLocal)
    
    
    if(!coverImage.url){
      throw new ApiError(400, "Error While updating cover Image in cloudinary")
    }
    
    //Delete Previous Image
    const publicId = req.user.coverImage.match(/\/v\d+\/(.+)\.\w{3,4}$/)[1]
    const deletePrevimage =  deleteOnCloudnary(publicId)

    const user = await User.findByIdAndUpdate(req.user?._Id,{
      $set:{
        coverImage : coverImage?.url 
      }
      
    },{
      new : true
    }).select("-password ")

    return res.status(200)
    .json(new ApiResponse(200 , user , "Cover image Updated Successfully"))

})

//Channel Profile
const getUserChannelProfile = asyncHandler( async(req, res)=>{
  const {username} =  req.params
  
  if(!username?.trim()){
    throw new ApiError(400, "Username is missing")
  }

  const channel = await User.aggregate([
    {
      $match : {
        username : username.toLowerCase()
      }
    },
    {
      $lookup :{
        from : "subscriptions" ,
        localField : "_id" ,
        foreignField : "channel" ,
        as : "subscribers"
      }
    },
    {
      $lookup :{
        from : "subscriptions" ,
        localField : "_id" ,
        foreignField : "subscriber" ,
        as : "subscribedTo"
      }
    },
    {
      $addFields :{
        subscriberCount : {
           $size : "$subscribers"
        },
        channelSubsribedTo :{
          $size : "$subscribedTo"  
        },
        isSubscribed:{
          $cond:{
            if: {$in: [req.user?._id   , "subscribers.subscriber"]},
            then: true,
            elase:false
          }
        }
      }
    },
    {
      $project : {
        fullName : 1,
        username : 1,
        avatar : 1,
        coverImage : 1,
        subscriberCount : 1,
        channelSubsribedTo : 1,
        isSubscribed : 1,
        email: 1 ,
      }
    }
  ])

  if(!channel?.length){
     throw new ApiError(404, "Channel not found")
  }

  return res.status(200)
          .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"))
})

//get Watch history of user
const getWatchHistory = asyncHandler( async(req, res)=>{
  const user = User.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
       $lookup :{
        from: "videos",
        localFeild : 'watchHistory',
        foreignField : "_id",
        as:"watchHistory",
        pipeline : [
          {
            $lookup : {
              from : "users",
              localField : "owner",
              foreignField : "_id",
              as : "owner",
              pipeline : [
                {
                  $project : {
                    fullName : 1 ,
                    avatar : 1 ,
                    username : 1 ,                    
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first : "$owner"
              }
            }
          }
        ]

       }
    },
  ])

  return res.status(200)
         .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"))

})




export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountdetails,
  updateUserAvatar,
  updateUsercoverImage,
  getUserChannelProfile,
  getWatchHistory
}