require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const URL = require('url').URL
const jsdom = require('jsdom').JSDOM
const Link = require('./schemas/link')
const Tag = require('./schemas/tag')
const stopword = require('stopword')
const readline = require('readline')

const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi
const noPageRegex = /\.(jpeg|jpg|png|gif|mp4|mp3|wav|css|js|webm|ogg|ico|sv|gz|zip|exe|jar|pdf|ttf)$/gi
let index = 0
let currentCommand = null

const download = async link => {
  const response = await axios.get(link, {
    headers: {
      'Accept': 'Accept: text/html, application/xhtml+xml',
      'Accept-Language': 'en'
    },
    timeout: 5000,
    transformResponse: res => res
  })
  return {
    data: response.data,
    contentType: response.headers['content-type']
  }
}

const parseHTML = html => { 
  return new jsdom(html).window.document
}

const retrieveLinks = async (parsed, url) => {
  const anchors = [... parsed.querySelectorAll('a')].map(e => new URL(e, url)).filter(e => e.host.length)
  const retrieved = [... new Set(anchors.map(e => e.origin))].filter(l => !l.match(noPageRegex))
  const final = (await Promise.all(retrieved.map(async url => {
    const found = await Link.findOne({ url })
    return found ? null : url
  }))).filter(e => e)
  return final
}

const retrieveContent = parsed => {
  const meta = parsed.querySelectorAll(
    'meta[name="description"],meta[property="og:title"],meta[property="og:description"]'
  )
  const metaContent = [...meta].map(e => e.getAttribute('content')).join('\n')
  const main = parsed.querySelectorAll(
    'title,#main,.main,main,[class*="main"],#title,[class*="title"],h1,h2,h3,h4,h5,h6,header,nav'
  )
  const mainContent = [...main].map(e => e.textContent).join('\n')
  return metaContent.concat(mainContent)
}

const parseContent = content => {
  const words = stopword.removeStopwords(
    content
    .replace(/\s+|[^\p{L}]/ugi, ' ')
    .split(' ')
    .filter(e => e.trim().length)
    .map(e => e.toLowerCase())
  ).filter(e => e.length > 2)
  return [... new Set(words)].slice(0, 100)
}

const saveLinks = async links => {
  if (!links || !links.length) return
  for (const link of links) {
    const doc = await Link.findOne({ url: link })
    if (!doc) {
      const newDoc = new Link({
        url: link,
        processed: 'no'
      })
      newDoc.save()
    }
  }
}

const saveTags = async (tags, url) => {
  if (!tags || !tags.length) return
  for (const tag of tags) {
    const doc = await Tag.findOne({ name: tag })
    if (doc) {
      if (!doc.urls.includes(url)) {
        doc.urls = [...new Set(doc.urls), url]
        await doc.save()
      }
    } else {
      const newDoc = new Tag({
        name: tag,
        urls: [url]
      })
      await newDoc.save()
    }
  }
}

const loadMoreLinks = async () => {
  return await Link.find({ processed: 'no' })
}

const markProcessed = async (url, status) => {
  await Link.findOneAndUpdate({ url }, { $set: { processed: status } })
}

const start = async (link) => {
  const linkQueue = [link]
  while (true) {
    let url = linkQueue.shift()
    try {
      if (!url) {
        const links = (await loadMoreLinks()).map(e => e.url)
        Array.prototype.push.apply(linkQueue, links)
        url = linkQueue.shift()
      }
      console.log('index:', index)
      console.log('url:', url)
      const info = await download(url)
      console.log('page downloaded')
      console.log('content-type:', info.contentType)
      if (info.contentType.includes('html')) {
        const parsed = parseHTML(info.data)
        console.log('parsed HTML')
        const links = await retrieveLinks(parsed, url)
        console.log('got links', links.length)
        await saveLinks(links)
        console.log('saved links')
        const content = retrieveContent(parsed)
        console.log('got content')
        const words = parseContent(content)
        console.log('got tags', words.length)
        await saveTags(words, url)
        console.log('saved tags')
        await markProcessed(url, 'yes')
        console.log('url marked as processed')
      }
    } catch (error) {
      console.log('error')
      console.log(url)
      console.error(error.message)
      if (['ENOTFOUND'].includes(error.code) || (error.response && error.response.status >= 400)) {
        await markProcessed(url, 'unavailable')
      }
    }
    index += 1
    if (currentCommand === 'close') {
      return
    }
  }
}

mongoose.connect(process.env.MONGO_STRING, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false
})
.then(() => {
  console.log('Connected to database')
  const startLink = process.argv[2]
  start(startLink)
  .then(() => {
    mongoose.connection.close()
  })
})
.catch(err => {
  console.error(err)
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

rl.on('line', line => {
  const command = line.trim()
  if (['close', 'exit', 'cl', 'ex'].includes(command)) {
    console.log('close')
    currentCommand = 'close'
    rl.close()
  }
})
