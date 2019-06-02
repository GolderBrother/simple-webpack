## 写一个bundler.js,将其中的ES6代码转换为ES5代码，并将这些文件打包，生成一段能在浏览器正确运行起来的代码。(最后输出say hello)

### 如果你真正理解了Webpack的定义，那么这里思路应该非常清晰：

 * 1、利用babel完成代码转换,并生成单个文件的依赖
 * 2、生成依赖图谱
 * 3、生成最后打包代码
 * 4、打包到指定文件(可选)


### install dependencies
npm install

### build for production with minification
npm run build