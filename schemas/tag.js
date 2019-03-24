const mongoose = require('mongoose')

const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  urls: [{
    type: String,
    required: true
  }]
})

const Tag = mongoose.model('tag', TagSchema, 'tags')

module.exports = Tag
