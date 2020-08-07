const path = require('path')
const PKGMetadata = require('../index.js')

const metadata = new PKGMetadata({

  distPath: '.dist',
  version: '1.1.1',
  name: 'test.exe',
  description: 'this is a test desc',
  author: 'MSz',
  nodeVersion: '12.13.1',
  autoGen: true,
  icon: path.join(__dirname, '../res/icon.ico'),
  rc: '',
  res: '',
  rcData: {
    FileDescription: 'this is a test desc',
    FileVersion: '1.1.1.2',
    // InternalName: 'test.exe',
    // LegalCopyright: 'me',
    // OriginalFilename: 'test.exe',
    // ProductName: 'test',
    ProductVersion: '1.1.1'
  },
  pkg: true,
  pkgOptions: [
    path.join(__dirname, 'pkgTest.js'),
    '--target',
    `node${'12.13.1'}-win`,
    '--output',
    path.join(__dirname, '../', '.dist/test.exe')
  ]
})

async function main () {
  try {
    await metadata.run()
  } catch (error) {
    console.log(error)
  }
}

main()
