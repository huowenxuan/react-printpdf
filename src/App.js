import React from 'react'
import logo from './logo.svg'
import './App.css'
import fontkit from "./print/fontkit"


import LineWrapper from './print/LineWrapper'

let body = '一段需要word。 wrap的文字wewewewewewewe...wewewewewewewewewewewewewewewewewewewewewewewewewewewewewewewewewewewe招风耳发的顺丰刹车阿斯UC阿斯醋还是和菜市场啊安士才吓死偶会 暗示擦啥是赤壁哦'
const textOptions = {
  font: '/MSYH.otf',
  width: 300,
  characterSpacing: 2,
}
let wrapper = new LineWrapper(textOptions)
wrapper.on('sectionStart', () => {
})
wrapper.on('line', (l) => {
  console.log(l)
})
wrapper.on('sectionEnd', () => {
})
wrapper.wrap(body, {})

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo"/>
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  )
}

export default App
