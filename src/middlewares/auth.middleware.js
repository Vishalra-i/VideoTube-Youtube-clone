import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import  Jwt  from "jsonwebtoken";


export const verifyJWT = asyncHandler(async(req,res,next)=>{
    try {
        const token = req.cookies?.accessToken || req.headers("Authorization")?.replace("Bearer ", "")
    
        if(!token){
            return res.status(401).json({message: "Unauthorized request"})
        }
         
        const decodedToken =  Jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user =  await User.findById(decodedToken?._id).select("-password -refreshToken")
        if(!user){
            return new ApiError(401, "invalid Access Token")
        }
    
        req.user = user;
    
        next()
    } catch (error) {
        throw new ApiError(401, error?.message ||"invalid Access Token")
    }
})