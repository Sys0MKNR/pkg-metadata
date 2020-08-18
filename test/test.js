const path = require('path')
const test = require('ava')
const fs = require('fs-extra')

const { PKGMetadata } = require('../index.js')

const TMP_PATH = path.join(__dirname, '.tmp')

test.before(async t => {
  await fs.ensureDir(TMP_PATH)
})

test('basic', t => {
  const opts = {
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

  const l = new PKGMetadata(opts)
  t.pass()
})
