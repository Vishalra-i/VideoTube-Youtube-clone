import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new  mongoose.Schema({
    subscriber:{
        type: Schema.Types.ObjectId , //Subscriber 
        ref : 'User'
    },
    channel:{
        type: Schema.Types.ObjectId , //Subscriber 
        ref : 'User'
    }

},{
        timestamps: true
})

export const Subscription = mongoose.model('Subscription' , subscriptionSchema)

