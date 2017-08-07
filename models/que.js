'use strict'

const mongoose = require('mongoose')
const Schema = mongoose.Schema

let s = new Schema(
  {
    action:{ // {action:-1, parcelId:1}
      type:String, // Next page, or get single page from person
      required: true,
      enum:['page','profile']
    },
    parcelId:{
      type:String,
      default:""
    },
    page:{
      type:Number,
      default:-1
    },
    rawLink:{
      type:String, // The link to the next page, or persons profile
      required:true
    },
    parsedLink:{
      url:String,
      uri:String,
      query:Schema.Types.Mixed
    },
    rawData:String,
    parsedData:String,
    status:{
      type:String,
      enum:['pause', 'ready', 'inprogress', 'done', 'error'],
      default:'pause'
    },
    log:[{
      status:String,
      date:Date,
      data:Schema.Types.Mixed
    }],
    updatedAt:{
      type:Date,
      default:() => { return new Date() }
    },
    createdAt:{
      type:Date,
      default:() => { return new Date() }
    }
  },
  {
    id: false,
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
  }
)

s.index({action:-1, parcelId:1, page:1});
s.index({action:1, page:1})
s.index({status:1});

module.exports = mongoose.model('Que', s)