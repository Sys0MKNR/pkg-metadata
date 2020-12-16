const path = require('path')
const { PKGMetadata } = require('../index.js')

const metadata = new PKGMetadata({
  keepTMP: true,
  // targets: [
  //   'node12-win-x64',
  //   'node12-win-x86',
  //   'node13',
  //   'host'
  // ],
  metaData: {
    version: '1.1.11',
    name: 'testCustom',
    description: 'this is a custom test desc',
    legal: 'copyright msz'
  },
  // icon: path.join(__dirname, '../res/icon.ico'),
  icon: path.join(__dirname, '../res/icon.png'),
  // rcFilePath: path.join(__dirname, 'bin.rc'),
  // rhPath: path.join(__dirname, '../', '.cache', 't', 'ResourceHacker.exe'),
  rcData: {
    // FileDescription: 'this is a test desc',
    // FileVersion: '1.1.1.2',
    // InternalName: 'test.exe',
    // LegalCopyright: 'me',
    // OriginalFilename: 'test.exe',
    // ProductName: 'test',
    // ProductVersion: '1.1.1'
  },
  pkg: {
    src: path.join(__dirname, 'pkgTest.js'),
    out: path.join(__dirname, '../', '.dist')
    // args: [
    //   path.join(__dirname, 'pkgTest.js'),
    //   '--target',
    //   `node${'12.13.1'}-win`,
    //   '--output',
    //   path.join(__dirname, '../', '.dist/test.exe')
    // ]
  }
})

async function main () {
  try {
    await metadata.run()
  } catch (error) {
    console.log(error)
  }
}

main()
