//导入包
const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

// 第一步:转换代码、 生成依赖
// 转换代码需要利用@babel/parser生成AST抽象语法树，然后利用@babel/traverse进行AST遍历，记录依赖关系，最后通过@babel/core和@babel/preset-env进行代码的转换
function stepOne(filename) {
    // 读入文件
    const content = fs.readFileSync(filename, 'utf-8');
    const ast = parser.parse(content, {
        //babel官方规定必须加这个参数，不然无法识别ES Module
        sourceType: 'module'
    })
    const dependencies = {};
    // 遍历AST抽象语法书
    traverse(ast, {
        ImportDeclaration({
            node
        }) {
            const dirname = path.dirname(filename);
            const newFile = './' + path.join(dirname, node.source.value);
            // 保存所依赖的模块
            dependencies[node.source.value] = newFile;
        }
    })

    // 通过 @babel/core 和 @babel/preset-env 进行代码的转换
    const {
        code
    } = babel.transformFromAst(ast, null, {
        presets: ["@babel/preset-env"]
    })

    return {
        filename, //该文件名
        dependencies, //该文件所依赖的模块集合(键值对存储)
        code //转换后的代码
    }
}


// 第二步：生成依赖图谱。
function stepTwo(entry) {
    const entryModule = stepOne(entry)
    //这个数组是核心，虽然现在只有一个元素，往后看你就会明白
    const graphArray = [entryModule];
    for (const i in graphArray) {
        const item = graphArray[i];
        const {
            dependencies
        } = item;
        for (const j in dependencies) {
            // 关键代码，目的是将入口模块及其所有相关的模块放入数组
            graphArray.push(stepOne(dependencies[j]));
        }
    }
    //接下来生成图谱
    const graph = {}
    graphArray.forEach(item => {
        graph[item.filename] = {
            dependencies: item.dependencies,
            code: item.code
        }
    })

    return graph
}

//entry为入口文件
function stepTwo(entry) {
    const entryModule = stepOne(entry)
    //这个数组是核心，虽然现在只有一个元素，往后看你就会明白
    const graphArray = [entryModule]
    for (let item of graphArray) {
        const {
            dependencies
        } = item; //拿到文件所依赖的模块集合(键值对存储)
        for (let j in dependencies) {
            // 关键代码，目的是将入口模块及其所有相关的模块放入数组
            graphArray.push(
                stepOne(dependencies[j])
            )
        }
    }
    //接下来生成图谱
    const graph = {}
    graphArray.forEach(item => {
        graph[item.filename] = {
            dependencies: item.dependencies,
            code: item.code
        }
    })
    return graph
}


//测试一下
// console.log(stepTwo('./src/index.js'));

/*
    { '../src/index.js':
   { dependencies: { './message.js': './..\\src\\message.js' },
     code: '"use strict";\n\nvar _message = _interopRequireDefault(require("./message.js"));\n\nfunction _interopRequireDefault(obj)
{ return obj && obj.__esModule ? obj : { "default": obj }; }\n\nconsole.log(_message["default"]);' },
  './..\\src\\message.js':
   { dependencies: { './word.js': './..\\src\\word.js' },
     code: '"use strict";\n\nObject.defineProperty(exports, "__esModule", {\n  value: true\n});\nexports["default"] = void 0;\n\nvar
_word = require("./word.js");\n\nvar message = "say ".concat(_word.word);\nvar _default = message;\nexports["default"] = _default;' } }
*/

// 第三步: 生成代码字符串
function stepThree(entry) {
    //要先把对象转换为字符串，不然在下面的模板字符串中会默认调取对象的toString方法，参数变成[Object object],显然不行
    const graph = JSON.stringify(stepTwo(entry))
    return `
        (function(graph) {
            //require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
            function require(module) {
                //localRequire的本质是拿到依赖包的exports变量
                function localRequire(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }
                var exports = {};
                (function(require, exports, code) {
                    eval(code);
                })(localRequire, exports, graph[module].code);
                return exports;//函数返回指向局部变量，形成闭包，exports变量在函数执行后不会被摧毁
            }
            require('${entry}')
        })(${graph})`
}


//最终测试
const code = stepThree('./src/index.js');
// console.log('code after build is that: %s', code);


/*
code after build is that:
        (function(graph) {
            //require函数的本质是执行一个模块的代码，然后将相应变量挂载到exports对象上
            function require(module) {
                //localRequire的本质是拿到依赖包的exports变量
                function localRequire(relativePath) {
                    return require(graph[module].dependencies[relativePath]);
                }
                var exports = {};
                (function(require, exports, code) {
                    eval(code);
                })(localRequire, exports, graph[module].code);
                return exports;//函数返回指向局部变量，形成闭包，exports变量在函数执行后不会被摧毁
            }
            require('../src/index.js')
        })({"../src/index.js":{"dependencies":{"./message.js":"./..\\src\\message.js"},"code":"\"use strict\";\n\nvar _message = _interopRequireDefault(require(\"./message.js\"));\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { \"default\": obj }; }\n\nconsole.log(_message[\"default\"]);"},"./..\\src\\message.js":{"dependencies":{"./word.js":"./..\\src\\word.js"},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports[\"default\"] = void 0;\n\nvar _word = require(\"./word.js\");\n\nvar message = \"say \".concat(_word.word);\nvar _default = message;\nexports[\"default\"] = _default;"},"./..\\src\\word.js":{"dependencies":{},"code":"\"use strict\";\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\nexports.word =
void 0;\nvar word = 'hello';\nexports.word = word;"}})
*/

// 将生成的这段代码字符串放在浏览器端执行  => say hello

// 第四步 写入文件
const mkdirTemp = function(temp){
    return new Promise((resolve, reject) => {
        fs.exists(temp, function(exists) {
            // 如果文件夹已存在，那就不创建
            if(exists) {
                resolve([null, true]);
            }else { // 不存在就新建
                fs.mkdir(temp, function(err, data){
                    if(err) {
                        return reject([err, null]);
                    }
                    resolve([null, true]);
                });
            }
        })
    });
}

mkdirTemp('dist').then(([err,res]) => {
    if(err) {
        return reject(err);
    }
    fs.writeFile('dist/main.js', code, 'utf8', function(err, data){
        if(err) {
            console.log(err);
            return;
        }
        console.log('打包成功，在 dist/ 目录下');
    })
}).catch(err => {
    console.log("err: %o", err);
})
