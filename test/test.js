const path = require('path')
const test = require('ava')
const fs = require('fs-extra')

const { PKGMetadata } = require('../index.js')

const TMP_PATH = path.join(__dirname, '.tmp')

test.before(async t => {
  await fs.ensureDir(TMP_PATH)
})

test('basic', async t => {
  // t.timeout('5m')

  const opts = {
    keepTMP: true,
    nodeVersion: '12.13.1',
    metaData: {
      version: '1.1.11',
      name: 'testCustom',
      description: 'this is a custom test desc',
      legal: 'copyright msz'
    },
    icon: path.join(__dirname, '../res/icon.ico'),
    pkg: {
      src: path.join(__dirname, 'pkgTest.js'),
      out: path.join(TMP_PATH, 'basic.exe')
    }
  }

  const p = new PKGMetadata(opts)
  await p.run()

  t.pass()
})
