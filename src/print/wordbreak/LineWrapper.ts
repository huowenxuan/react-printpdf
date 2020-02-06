import fontkit from './fontkit'

const LineBreaker = require('./linebreak/linebreaker')
const EventEmitter = require('events')

// const LineBreaker = require('linebreak')

class Font {
  font
  name
  scale
  xHeight
  capHeight
  lineGap
  bbox
  layoutCache: any[] = []

  constructor(options) {
    const {font} = options
    this.font = font
    this.name = this.font.postscriptName
    this.scale = 1000 / this.font.unitsPerEm
    this.xHeight = this.font.xHeight * this.scale
    this.capHeight = this.font.capHeight * this.scale
    this.lineGap = this.font.lineGap * this.scale
    this.bbox = this.font.bbox
  }

  layoutRun(text, features?) {
    const run = this.font.layout(text, features) // Normalize position values
    for (let i = 0; i < run.positions.length; i++) {
      const position = run.positions[i]
      for (let key in position)
        position[key] *= this.scale
      position.advanceWidth = run.glyphs[i].advanceWidth * this.scale
    }
    return run
  }

  layoutCached(text) {
    if (!this.layoutCache) return this.layoutRun(text)
    let cached = this.layoutCache[text]
    if (cached) return cached
    const run = this.layoutRun(text)
    this.layoutCache[text] = run
    return run
  }

  layout(text, features, onlyWidth) {
    if (features) return this.layoutRun(text, features)
    let glyphs: any = onlyWidth ? null : []
    let positions: any = onlyWidth ? null : []
    let advanceWidth = 0 // Split the string by words to increase cache efficiency.

    let last = 0
    let index = 0
    while (index <= text.length) {
      var needle
      if (index === text.length && last < index || (needle = text.charAt(index), [' ', '\t'].includes(needle))) {
        const run = this.layoutCached(text.slice(last, ++index))
        if (!onlyWidth) {
          glyphs = glyphs.concat(run.glyphs)
          positions = positions.concat(run.positions)
        }
        advanceWidth += run.advanceWidth
        last = index
      } else {
        index++
      }
    }
    return {glyphs, positions, advanceWidth}
  }

  widthOfString(string, size, features?) {
    const width = this.layout(string, features, true).advanceWidth
    const scale = size / 1000
    return width * scale
  }
}

export default class LineWrapper extends EventEmitter {
  indent
  characterSpacing
  wordSpacing
  columns
  columnGap
  lineWidth
  spaceLeft
  startX = 0
  column = 1
  ellipsis
  continuedX = 0
  features
  font
  fontSize
  fontPath
  width

  constructor(public options) {
    super()
    this.options = options || {}
    this.setMaxListeners(Infinity) // 取消添加过的的监听器超过上限警告
    this.refresh()
  }

  refresh() {
    const {options} = this
    const {
      width = 500,
    } = options
    this.indent = options.indent || 0
    this.fontSize = options.fontSize || 16
    this.characterSpacing = options.characterSpacing || 0
    this.wordSpacing = options.wordSpacing === 0
    this.columns = options.columns || 1
    this.columnGap = options.columnGap != null ? options.columnGap : 18 // 1/4 inch
    this.lineWidth =
      (width - this.columnGap * (this.columns - 1)) / this.columns
    this.spaceLeft = this.lineWidth
    this.ellipsis = options.ellipsis
    this.features = options.features
    this.fontPath = options.font

    this.on('firstLine', options => {
      // if this is the first line of the text segment, and
      // we're continuing where we left off, indent that much
      // otherwise use the user specified indent option
      const indent = this.continuedX || this.indent
      this.lineWidth -= indent

      return this.once('line', () => {
        this.lineWidth += indent
        if (options.continued && !this.continuedX) {
          this.continuedX = this.indent
        }
        if (!options.continued) {
          return (this.continuedX = 0)
        }
      })
    })

    // handle left aligning last lines of paragraphs
    this.on('lastLine', options => {
      const {align} = options
      if (align === 'justify') {
        options.align = 'left'
      }

      return this.once('line', () => {
        options.align = align
      })
    })
  }

  async initFont() {
    if (this.font) return
    this.font = new Font({
      font: await fontkit.openFont(this.fontPath)
    })
  }

  end() {
    this.removeAllListeners('line')
  }

  setOptions(fontsize, width){
    this.options.fontSize = fontsize
    this.options.width = width
  }

  wordWidth(word) {
    return (
      this.font.widthOfString(word, this.fontSize) +
      this.characterSpacing +
      this.wordSpacing
    )
  }

  eachWord(text, fn) {
    // setup a unicode line breaker
    let bk
    const breaker = new LineBreaker(text)
    let last: any = null
    const wordWidths = Object.create(null)

    while ((bk = breaker.nextBreak())) {
      var shouldContinue
      let word = text.slice(
        (last != null ? last.position : undefined) || 0,
        bk.position
      )
      let w =
        wordWidths[word] != null
          ? wordWidths[word]
          : (wordWidths[word] = this.wordWidth(word))

      // if the word is longer than the whole line, chop it up
      // TODO: break by grapheme clusters, not JS string characters
      if (w > this.lineWidth + this.continuedX) {
        // make some fake break objects
        let lbk = last
        const fbk: any = {}

        while (word.length) {
          // fit as much of the word as possible into the space we have
          var l, mightGrow
          if (w > this.spaceLeft) {
            // start our check at the end of our available space - this method is faster than a loop of each character and it resolves
            // an issue with long loops when processing massive words, such as a huge number of spaces
            l = Math.ceil(this.spaceLeft / (w / word.length))
            w = this.wordWidth(word.slice(0, l))
            mightGrow = w <= this.spaceLeft && l < word.length
          } else {
            l = word.length
          }
          let mustShrink = w > this.spaceLeft && l > 0
          // shrink or grow word as necessary after our near-guess above
          while (mustShrink || mightGrow) {
            if (mustShrink) {
              w = this.wordWidth(word.slice(0, --l))
              mustShrink = w > this.spaceLeft && l > 0
            } else {
              w = this.wordWidth(word.slice(0, ++l))
              mustShrink = w > this.spaceLeft && l > 0
              mightGrow = w <= this.spaceLeft && l < word.length
            }
          }

          // check for the edge case where a single character cannot fit into a line.
          if (l === 0 && this.spaceLeft === this.lineWidth) {
            l = 1
          }

          // send a required break unless this is the last piece and a linebreak is not specified
          fbk.required = bk.required || l < word.length
          shouldContinue = fn(word.slice(0, l), w, fbk, lbk)
          lbk = {required: false}

          // get the remaining piece of the word
          word = word.slice(l)
          w = this.wordWidth(word)

          if (shouldContinue === false) {
            break
          }
        }
      } else {
        // otherwise just emit the break as it was given to us
        shouldContinue = fn(word, w, bk, last)
      }

      if (shouldContinue === false) {
        break
      }
      last = bk
    }
  }

  async wrap(text, options) {
    this.refresh()
    await this.initFont()

    // override options from previous continued fragments
    if (options.indent != null) {
      this.indent = options.indent
    }
    if (options.characterSpacing != null) {
      this.characterSpacing = options.characterSpacing
    }
    if (options.wordSpacing != null) {
      this.wordSpacing = options.wordSpacing
    }
    if (options.ellipsis != null) {
      this.ellipsis = options.ellipsis
    }

    let buffer = ''
    let textWidth = 0
    let wc = 0
    let lc = 0

    const emitLine = () => {
      options.textWidth = textWidth + this.wordSpacing * (wc - 1)
      options.wordCount = wc
      options.lineWidth = this.lineWidth
      this.emit('line', buffer, options, this)
      return lc++
    }

    this.emit('sectionStart', options, this)

    this.eachWord(text, (word, w, bk, last) => {
      if (last == null || last.required) {
        this.emit('firstLine', options, this)
        this.spaceLeft = this.lineWidth
      }

      if (w <= this.spaceLeft) {
        buffer += word
        textWidth += w
        wc++
      }

      if (bk.required || w > this.spaceLeft) {
        if (bk.required) {
          if (w > this.spaceLeft) {
            emitLine()
            buffer = word
            textWidth = w
            wc = 1
          }
          this.emit('lastLine', options, this)
        }

        emitLine()

        // reset the space left and buffer
        if (bk.required) {
          this.spaceLeft = this.lineWidth
          buffer = ''
          textWidth = 0
          return (wc = 0)
        } else {
          // reset the space left and buffer
          this.spaceLeft = this.lineWidth - w
          buffer = word
          textWidth = w
          return (wc = 1)
        }
      } else {
        return (this.spaceLeft -= w)
      }
    })

    if (wc > 0) {
      this.emit('lastLine', options, this)
      emitLine()
    }

    this.emit('sectionEnd', options, this)
    this.removeAllListeners('sectionEnd')

    // if the wrap is set to be continued, save the X position
    // to start the first line of the next segment at, and reset
    // the y position
    if (options.continued === true) {
      if (lc > 1) {
        this.continuedX = 0
      }
      this.continuedX += options.textWidth || 0
      return 0
    } else {
      return this.startX
    }
  }
}

