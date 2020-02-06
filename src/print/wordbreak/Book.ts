import * as PDFDocument from 'pdfkit'
import axios from 'axios'
import uuidv1 from 'uuid/v1'
import * as URI from 'urijs'
import * as path from 'path'
import * as sizeOf from 'image-size'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'


export default class Book {
  doc
  beginTime = new Date()
  fontSize = 15
  tmpFiles: string[] = []

  constructor(path, config) {
    const {height = 100, width = 100, marginH = 0, marginW = 0} = config
    this.doc = new PDFDocument({
      margins: {
        top: marginH,
        left: marginW,
        bottom: marginH,
        right: marginW,
      },
      size: [width, height],
      align: 'center',
      valign: 'center'
    })
    this.doc.pipe(fs.createWriteStream(path))
    this.doc.fontSize(this.fontSize)
  }

  /*
lineBreak-设置为false禁用所有换行
width -文本应换行的宽度（默认情况下，页面宽度减去左右边距）
height -文本应剪切到的最大高度
ellipsis-太长时显示在文本末尾的字符。设置为true使用默认字符。
columns -文本流入的列数
columnGap -每列之间的间距（默认为1/4英寸）
indent -以PDF磅为单位（每英寸72英寸）的缩进量
paragraphGap -文本各段之间的间距
lineGap -每行文字之间的间距
wordSpacing -文本中每个单词之间的间距
characterSpacing -文本中每个字符之间的间距
fill-是否填写文字（true默认情况下）
stroke -是否描边文本
link -链接此文本的URL（创建注释的快捷方式）
underline -是否在文字下划线
strike -是否删除文字
oblique-是否倾斜文字（角度或度数true）
baseline-文本相对于其插入点的垂直对齐方式（值为canvas textBaseline）
continued-文本段是否紧随其后。对于更改段落中间的样式很有用。
features- 要应用的OpenType功能标签的数组。如果未提供，则使用一组默认值
   */
  addText(text, options) {
    const {
      fontSize = 16,
      width,
      font,
    } = options
    this.doc
      .font(font)
      // .font('./fonts/kt.ttf')
      .fontSize(fontSize)
      .text(text, {
        ...options,
        width: width + 10,
        align: 'justify',
        lineBreak: false,
      })
    this.fontSize = fontSize
  }

  addImage(path, rect) {
    const {x = 0, y = 0, width, height} = rect
    this.doc.image(path, x, y, {
      fit: [width, height],
    })
  }

  // 先将文字大小改为目标大小，再添加一行空白，再把大小改回去
  moveDown(px = 15) {
    this.doc.fontSize(px)
    // 添加n行空白，和上一行的字体有关
    this.doc.moveDown(1)
    this.doc.fontSize(this.fontSize)
  }

  widthOfString(text) {
    return this.doc.widthOfString(text)
  }

  heightOfString(text) {
    return this.doc.heightOfString(text)
  }

  addPage() {
    this.doc.addPage()
  }

  addLink() {
    this.doc.addPage()
      .fillColor("blue")
      .text('Here is a link!', 100, 100)
      .underline(100, 100, 160, 27, {color: "#0000FF"})
      .link(100, 100, 160, 27, 'http://google.com/')
  }

  end() {
    this.doc.end()
    // for (let path of this.tmpFiles) fs.unlinkSync(path)
    console.log("用时" + ((new Date()).valueOf() - this.beginTime.valueOf()) + "ms")
  }

  async downloadImage(url) : Promise<any> {
    // url = url.split('?')[0]
    const uri = new URI(url)
    const filename = uri.filename() + '.jpg'
    // const filename = uuidv1()
    const filePath = __dirname + `/../public/tmp/${filename}`
    if (fs.existsSync(filePath)) return {path: filePath}

    let reqUtil: any = http
    if (url.startsWith('https')) reqUtil = https

    const that = this
    return new Promise((resolve, reject) => {
      reqUtil.get(url, res => {
        let imgData = ""
        res.setEncoding("binary") //一定要设置response的编码为binary否则会下载下来的图片打不开
        res.on("data", chunk => imgData += chunk)
        res.on("end", () => {
          fs.writeFile(filePath, imgData, "binary", function (err) {
            if (err) return reject(err)
            resolve({path: filePath})
            // sizeOf(filePath, (err, {width, height}) => {
            //   resolve({
            //     path: filePath,
            //     width,
            //     height
            //   })
            //   that.tmpFiles.push(filePath)
            // })
          })
        })
      })
    })
  }

  async downloadImageBuffer(url) {
    let response = await axios.get(url, {responseType: 'arraybuffer'})
    return Buffer.from(response.data)
  }

//   async drawText(text, config) {
//     const puppeteer = require('puppeteer')
//     config = config || {}
//     const {
//       width = 100, height = 100, fontSize = 17
//     } = config
//
//     function getImgSrc(text, width, height, font) {
//       return `
//     data:image/svg+xml;charset=utf-8,
//   <svg style="padding:0;margin:0;" xmlns="http://www.w3.org/2000/svg">
//     <foreignObject width="${width}" height="${height}">
//       <body xmlns="http://www.w3.org/1999/xhtml" style="padding:0;margin:0">
//         <p style="font-size:${font}px;margin:0;padding:0;word-break: break-word;line-height:1.5em;font-family:'STKaiti'">${text}</p>
//       </body>
//     </foreignObject>
//   </svg>
//   `
//     }
//
//     let htmlSrc = `
//   <canvas
//     id="canvas"
//     width="${width * 2}"
//     height="${height * 2}"
//     style="padding:0;margin:0;width:${width}px; height:${height}px"></canvas>
// <script type="text/javascript">
//   const canvas = document.getElementById("canvas")
//   const ctx = canvas.getContext('2d')
//   let textImg = new Image()
//   textImg.onload = () => ctx.drawImage(textImg, 0, 0)
//   textImg.src = \`${getImgSrc(text, width * 2, height * 2, fontSize * 2)}\`
// </script>
//   `
//     const browser = await puppeteer.launch()
//     const page = await browser.newPage()
//     const defaultPadding = 8
//     await page.setViewport({width: width + defaultPadding, height: height + defaultPadding, deviceScaleFactor: 2})
//     await page.setContent(htmlSrc)
//     let imgName = uuidv1() + '.jpg'
//     let imgPath = path.resolve(__dirname + '/tmp/' + imgName)
//
//     await page.screenshot({
//       clip: {
//         x: defaultPadding,
//         y: defaultPadding,
//         width,
//         height
//       },
//       // fullPage: true,
//       path: imgPath
//     })
//     // await page.pdf({path: 'hn.pdf'})
//     this.tmpFiles.push(imgPath)
//     this.addImage(imgPath, {width, height})
//     page.close()
//   }
}

