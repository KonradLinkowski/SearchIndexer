const mongoose = require('mongoose')

const LinkSchema = new mongoose.Schema({
  url: {
    type: String,
    unique: true,
    required: true
  },
  processed: {
    type: Boolean
  }
})

const Link = mongoose.model('link', LinkSchema, 'links')

module.exports = Link
