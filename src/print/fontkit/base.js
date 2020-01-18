import * as r from 'restructure'

const fs = require('fs')

var fontkit = {}
export default fontkit

fontkit.logErrors = false

let formats = []
fontkit.registerFormat = function (format) {
  formats.push(format)
}

fontkit.openFont = async (font, postscriptName) => {
  let isNode = global.constructor.name === 'Window' ? false : true
  if (isNode) {
    let buffer = require('fs').readFileSync(font)
    return fontkit.create(buffer, postscriptName)
  } else {
    return new Promise((resolve, reject) => {
      fetch(font)
        .then(res => res.blob())
        .then((blob) => {
          let reader = new FileReader()
          reader.onload = (e) => {
            let buffer = new Uint8Array(reader.result)
            buffer = Buffer.from(buffer.buffer)
            let font = fontkit.create(buffer, postscriptName)
            resolve(font)
          }
          reader.readAsArrayBuffer(blob)
        })
    })
  }
}

// fontkit.open = function (filename, postscriptName, callback) {
//   if (typeof postscriptName === 'function') {
//     callback = postscriptName
//     postscriptName = null
//   }
//
//   fs.readFile(filename, function (err, buffer) {
//     if (err) {
//       return callback(err)
//     }
//
//     try {
//       var font = fontkit.create(buffer, postscriptName)
//     } catch (e) {
//       return callback(e)
//     }
//
//     return callback(null, font)
//   })
//
//   return
// }

fontkit.create = function (buffer, postscriptName) {
  for (let i = 0; i < formats.length; i++) {
    let format = formats[i]
    if (format.probe(buffer)) {
      let font = new format(new r.DecodeStream(buffer))
      if (postscriptName) {
        return font.getFont(postscriptName)
      }
      console.info('字体初始化成功')
      return font
    }
  }

  throw new Error('Unknown font format')
}

fontkit.defaultLanguage = 'en'
fontkit.setDefaultLanguage = function (lang = 'en') {
  fontkit.defaultLanguage = lang
}