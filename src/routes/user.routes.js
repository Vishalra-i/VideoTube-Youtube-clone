import { Router } from "express";
import { loginUser, logoutUser, registerUser ,refreshAccessToken, updateUserAvatar, updateUsercoverImage } from "../controller/user.controller.js";
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
router.route("/update-avatar").post( verifyJWT ,upload.single("avatar"),updateUserAvatar)
router.route("/update-cover").post( verifyJWT ,upload.single("avatar"),updateUsercoverImage)

export default router;