import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY , 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath)=>{
   try {
      if(!localFilePath)return null
      //Upload on cloudinary
      const response = await cloudinary.uploader.upload(localFilePath,{
        resource_type: "auto"
     })
    //file Upload Succesfully
     fs.unlinkSync(localFilePath);//Remove local temporary file
     return response
     
   } catch (error) {
      console.log("Error on uploading file on Cloudinary", error);
      fs.unlinkSync(localFilePath);//Remove local temporary file
      return null
   }
}

const deleteOnCloudnary = async (publicId)=>{
    if(!publicId) console.log("Error on public id")
    try {
        const response = await cloudinary.uploader.destroy(publicId)
        return response
    }catch(error){
        console.log("Error on deleting file on Cloudinary", error);
        return null;
    }

}

export {uploadOnCloudinary , deleteOnCloudnary}
