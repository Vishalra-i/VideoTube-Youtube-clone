import { Router } from "express";
import { loginUser, logoutUser, registerUser ,refreshAccessToken, updateUserAvatar, updateUsercoverImage, changeCurrentPassword, getCurrentUser, updateAccountdetails, getUserChannelProfile, getWatchHistory } from "../controller/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

//register
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },{
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

//login
router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post( verifyJWT , logoutUser)
router.route("/refresh-Token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountdetails)
router.route("/update-avatar").patch( verifyJWT ,upload.single("avatar"),updateUserAvatar)
router.route("/update-cover").patch( verifyJWT ,upload.single("coverImage"),updateUsercoverImage)
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT,getWatchHistory)

export default router;